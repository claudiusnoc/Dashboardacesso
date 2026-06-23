param(
  [string]$WorkbookPath = "ACESSO PENDENCIAS.xlsx",
  [string]$OutputPath = "data/dashboard-data.json"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipEntryText {
  param($Zip, [string]$Name)
  $entry = $Zip.Entries | Where-Object { $_.FullName -eq $Name } | Select-Object -First 1
  if (-not $entry) { return $null }

  $reader = [System.IO.StreamReader]::new($entry.Open())
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Get-XmlText {
  param($Node)
  if ($null -eq $Node) { return "" }

  if ($Node -is [array]) {
    return (($Node | ForEach-Object { Get-XmlText $_ }) -join "")
  }

  if ($Node -is [System.Xml.XmlNode]) {
    return [string]$Node.InnerText
  }

  return [string]$Node
}

function Get-ColNumber {
  param([string]$Ref)
  $letters = ([regex]::Match($Ref, "^[A-Z]+")).Value
  $number = 0
  foreach ($char in $letters.ToCharArray()) {
    $number = ($number * 26) + ([int][char]$char - [int][char]'A' + 1)
  }
  return $number
}

function Convert-ExcelDate {
  param($Value)
  if ([string]::IsNullOrWhiteSpace([string]$Value)) { return "" }
  $serial = 0.0
  if ([double]::TryParse([string]$Value, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$serial)) {
    if ($serial -gt 20000 -and $serial -lt 80000) {
      return ([datetime]"1899-12-30").AddDays($serial).ToString("dd/MM/yyyy")
    }
  }
  return [string]$Value
}

function Normalize-Status {
  param([string]$Status)
  $value = ([string]$Status).Trim().ToUpperInvariant()
  if ($value) { return $value }
  return "SEM STATUS"
}

function Normalize-Header {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
  $normalized = $Value.Trim().Normalize([Text.NormalizationForm]::FormD)
  $builder = [Text.StringBuilder]::new()
  foreach ($char in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($char) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($char)
    }
  }
  return (($builder.ToString().Normalize([Text.NormalizationForm]::FormC).ToUpperInvariant()) -replace "\s+", " ")
}

function Get-Category {
  param([string]$Status, [string]$Stage)
  $statusValue = Normalize-Status $Status
  $stageValue = ([string]$Stage).ToLowerInvariant()

  if ($statusValue -eq "LIBERADO") { return "Liberação concluída" }
  if ($stageValue -match "cadastro|mobiliza") { return "Mobilização/cadastro" }
  if ($stageValue -match "sms|document") { return "Documentação" }
  if ($stageValue -match "retorno|tratativa|aguard") { return "Tratativa com detentora" }
  if ($statusValue -eq "LEVANTAMENTO DE DOCUMENTOS") { return "Documentação" }
  if ($statusValue -eq "EM TRATATIVA") { return "Tratativa com detentora" }
  return "Documentação"
}

function Get-NextAction {
  param([string]$Status, [string]$Stage, [string]$Owner)
  $statusValue = Normalize-Status $Status
  $stageValue = ([string]$Stage).Trim()
  $ownerValue = ([string]$Owner).Trim()
  $ownerText = if ($ownerValue) { " com $ownerValue" } else { "" }

  if ($statusValue -eq "LIBERADO") { return "Manter evidência e acompanhar validade do acesso." }
  if ($stageValue -match "SMS") { return "Acompanhar retorno de SMS e registrar próxima pendência." }
  if ($stageValue -match "retorno") { return "Reforçar contato$ownerText e registrar retorno." }
  if ($stageValue -match "cadastro|mobiliza") { return "Avançar cadastro/mobilização$ownerText." }
  if ($stageValue -match "document") { return "Concluir checklist documental$ownerText e reenviar para validação." }
  return "Atualizar responsável e próximo passo operacional."
}

function Count-ByField {
  param($Rows, [string]$Field)
  return @($Rows |
    Group-Object -Property { $_[$Field] } |
    Sort-Object -Property @{ Expression = "Count"; Descending = $true }, @{ Expression = "Name"; Descending = $false } |
    ForEach-Object {
      [ordered]@{
        label = if ($_.Name) { $_.Name } else { "Sem informação" }
        value = $_.Count
      }
    })
}

$fullWorkbookPath = Resolve-Path $WorkbookPath
$zip = [System.IO.Compression.ZipFile]::OpenRead($fullWorkbookPath)

try {
  [xml]$workbook = Read-ZipEntryText $zip "xl/workbook.xml"
  [xml]$rels = Read-ZipEntryText $zip "xl/_rels/workbook.xml.rels"
  [xml]$sharedStringsXml = Read-ZipEntryText $zip "xl/sharedStrings.xml"

  $sharedStrings = @()
  if ($sharedStringsXml) {
    foreach ($item in $sharedStringsXml.sst.si) {
      $sharedStrings += (Get-XmlText $item)
    }
  }

  $firstSheet = $workbook.workbook.sheets.sheet[0]
  $relationship = $rels.Relationships.Relationship |
    Where-Object { $_.Id -eq $firstSheet.id } |
    Select-Object -First 1
  $sheetPath = if ($relationship.Target -like "xl/*") {
    $relationship.Target
  } else {
    "xl/" + $relationship.Target.TrimStart("/")
  }

  [xml]$sheet = Read-ZipEntryText $zip $sheetPath

  function Get-CellValue {
    param($Cell)
    $value = Get-XmlText $Cell.v
    if ($Cell.t -eq "s") {
      if ($value -eq "") { return "" }
      return $sharedStrings[[int]$value]
    }
    if ($Cell.t -eq "inlineStr") { return Get-XmlText $Cell.is }
    return $value
  }

  $rows = @($sheet.worksheet.sheetData.row)
  $headerRow = $rows |
    Where-Object {
      $cellValues = @($_.c | ForEach-Object { Normalize-Header (Get-CellValue $_) })
      $cellValues -contains "ESTACAO COMPLETA"
    } |
    Select-Object -First 1

  if (-not $headerRow) {
    throw "Nao encontrei a linha de cabecalho com 'ESTACAO COMPLETA' na primeira aba."
  }

  $headers = @{}
  foreach ($cell in $headerRow.c) {
    $header = Normalize-Header (Get-CellValue $cell)
    if ($header) { $headers[$header] = Get-ColNumber $cell.r }
  }

  $requiredHeaders = @("INICIO", "ESTACAO COMPLETA", "CLUSTER", "ENDERECO", "EMPRESA", "DETENTORA", "DETALHES PENDENCIA", "STATUS", "ETAPA", "OBS:", "RESPONSABILIDADE ATUAL")
  foreach ($header in $requiredHeaders) {
    if (-not $headers.ContainsKey($header)) {
      throw "Coluna obrigatoria ausente na primeira aba: $header"
    }
  }

  function Get-CellByHeader {
    param($Cells, $Headers, [string]$Header)
    if (-not $Headers.ContainsKey($Header)) { return $null }
    return $Cells[$Headers[$Header]]
  }

  function Convert-OptionalDouble {
    param($Value)
    if ([string]::IsNullOrWhiteSpace([string]$Value)) { return $null }

    $text = ([string]$Value).Trim().Replace(",", ".")
    $number = 0.0
    if ([double]::TryParse($text, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
      return $number
    }

    return $null
  }

  $dataRows = @()
  foreach ($row in ($rows | Where-Object { [int]$_.r -gt [int]$headerRow.r })) {
    $cells = @{}
    foreach ($cell in $row.c) {
      $cells[(Get-ColNumber $cell.r)] = Get-CellValue $cell
    }

    $site = ([string]$cells[$headers["ESTACAO COMPLETA"]]).Trim()
    if (-not $site) { continue }

    $status = Normalize-Status $cells[$headers["STATUS"]]
    $stage = ([string]$cells[$headers["ETAPA"]]).Trim()
    $owner = ([string]$cells[$headers["RESPONSABILIDADE ATUAL"]]).Trim()
    $category = Get-Category $status $stage

    $dataRows += [ordered]@{
      id = $dataRows.Count + 1
      row = [int]$row.r
      start = Convert-ExcelDate $cells[$headers["INICIO"]]
      site = $site
      cluster = ([string]$cells[$headers["CLUSTER"]]).Trim()
      address = ([string]$cells[$headers["ENDERECO"]]).Trim()
      lat = Convert-OptionalDouble (Get-CellByHeader $cells $headers "LATITUDE")
      lng = Convert-OptionalDouble (Get-CellByHeader $cells $headers "LONGITUDE")
      company = ([string]$cells[$headers["EMPRESA"]]).Trim()
      holder = ([string]$cells[$headers["DETENTORA"]]).Trim()
      details = ([string]$cells[$headers["DETALHES PENDENCIA"]]).Trim()
      status = $status
      stage = $stage
      current_responsibility = $owner
      notes = ([string]$cells[$headers["OBS:"]]).Trim()
      category = $category
      next_action = Get-NextAction $status $stage $owner
    }
  }

  $liberado = @($dataRows | Where-Object { $_.status -eq "LIBERADO" }).Count
  $emAberto = @($dataRows | Where-Object { $_.status -ne "LIBERADO" }).Count
  $semStatus = @($dataRows | Where-Object { $_.status -eq "SEM STATUS" }).Count

  $payload = [ordered]@{
    generated_at = (Get-Date).ToString("dd/MM/yyyy HH:mm")
    source_file = (Split-Path $WorkbookPath -Leaf)
    source_sheet = [string]$firstSheet.name
    metrics = [ordered]@{
      total = $dataRows.Count
      liberado = $liberado
      em_aberto = $emAberto
      sem_status = $semStatus
      percent_liberado = if ($dataRows.Count) { [math]::Round(($liberado / $dataRows.Count) * 100, 1) } else { 0 }
    }
    series = [ordered]@{
      status = Count-ByField $dataRows "status"
      cluster = Count-ByField $dataRows "cluster"
      holder = Count-ByField $dataRows "holder"
      company = Count-ByField $dataRows "company"
      category = Count-ByField $dataRows "category"
      stage = Count-ByField $dataRows "stage"
      current_responsibility = Count-ByField $dataRows "current_responsibility"
    }
    rows = $dataRows
    critical = @($dataRows |
      Where-Object { $_.status -ne "LIBERADO" } |
      Sort-Object @{ Expression = { if ($_.current_responsibility) { 0 } else { 1 } } }, row |
      Select-Object -First 6)
    details = [ordered]@{}
  }

  $outputFullPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath
  } else {
    Join-Path (Get-Location) $OutputPath
  }
  $outputDir = Split-Path $outputFullPath -Parent
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  $json = ($payload | ConvertTo-Json -Depth 8) -replace "`r`n", "`n"
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($outputFullPath, $json, $utf8NoBom)

  Write-Output "Gerado: $OutputPath"
  Write-Output "Linhas uteis: $($dataRows.Count)"
  Write-Output "Fonte: $($firstSheet.name)"
} finally {
  $zip.Dispose()
}
