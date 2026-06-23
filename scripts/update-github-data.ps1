param(
  [string]$WorkbookPath = "C:\Users\Claudius\OneDrive - EQS Engenharia Ltda\ACESSO PENDENCIAS.xlsx",
  [string]$Branch = "main",
  [string]$CommitMessage = "Atualiza dados do dashboard",
  [switch]$SkipGit,
  [switch]$PauseOnExit
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ProjectRoot "logs"
$LogPath = Join-Path $LogDir ("dashboard-automation-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log {
  param([string]$Message)
  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  Write-Output $line
}

function Wait-BeforeExit {
  if ($PauseOnExit) {
    Write-Host ""
    Write-Host "Log salvo em:"
    Write-Host $LogPath
    Read-Host "Pressione ENTER para fechar"
  }
}

function Invoke-LoggedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$Arguments = @(),
    [switch]$AllowFailure
  )

  $display = "$FilePath $($Arguments -join ' ')".Trim()
  Write-Log "Executando: $display"

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $FilePath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  foreach ($line in @($output)) {
    if ($null -ne $line -and -not [string]::IsNullOrWhiteSpace([string]$line)) {
      Write-Log ("  " + [string]$line)
    }
  }

  Write-Log "Codigo de saida: $exitCode"

  if (($exitCode -ne 0) -and (-not $AllowFailure)) {
    throw "Comando falhou ($exitCode): $display"
  }

  return @{
    Output = @($output)
    ExitCode = $exitCode
  }
}

function Resolve-CommandPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName,
    [string[]]$FallbackPaths = @()
  )

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  foreach ($path in $FallbackPaths) {
    if (Test-Path -LiteralPath $path) {
      return $path
    }
  }

  throw "Comando nao encontrado: $CommandName"
}

function Resolve-WorkbookPath {
  param([string]$ExplicitPath)

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
    if (-not (Test-Path -LiteralPath $ExplicitPath)) {
      throw "Planilha informada nao encontrada: $ExplicitPath"
    }
    return (Resolve-Path -LiteralPath $ExplicitPath).Path
  }

  $candidate = Join-Path $env:USERPROFILE "OneDrive - EQS Engenharia Ltda\ACESSO PENDENCIAS.xlsx"
  if (-not (Test-Path -LiteralPath $candidate)) {
    throw "Planilha nao encontrada: $candidate"
  }

  return (Resolve-Path -LiteralPath $candidate).Path
}

try {
  Write-Log "Inicio da automacao."
  Write-Log "Projeto: $ProjectRoot"
  Write-Log "Usuario: $env:USERNAME"
  Write-Log "PowerShell: $($PSVersionTable.PSVersion)"
  Write-Log "Log: $LogPath"

  Set-Location -LiteralPath $ProjectRoot

  $PowerShellExe = Resolve-CommandPath -CommandName "powershell.exe" -FallbackPaths @(
    (Join-Path $PSHOME "powershell.exe")
  )
  $GitExe = Resolve-CommandPath -CommandName "git.exe" -FallbackPaths @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe",
    "C:\Users\Claudius\AppData\Local\Programs\Git\cmd\git.exe"
  )
  Write-Log "PowerShell exe: $PowerShellExe"
  Write-Log "Git exe: $GitExe"

  $ResolvedWorkbookPath = Resolve-WorkbookPath $WorkbookPath
  Write-Log "Planilha: $ResolvedWorkbookPath"

  if (-not $SkipGit) {
    Invoke-LoggedCommand -FilePath $GitExe -Arguments @("fetch", "origin", $Branch) | Out-Null
    Invoke-LoggedCommand -FilePath $GitExe -Arguments @("checkout", $Branch) | Out-Null
    Invoke-LoggedCommand -FilePath $GitExe -Arguments @("pull", "--rebase", "origin", $Branch) | Out-Null
    Invoke-LoggedCommand -FilePath $GitExe -Arguments @("status", "--short", "--branch") | Out-Null
  }

  $builder = Join-Path $ScriptDir "build-dashboard-data.ps1"
  Invoke-LoggedCommand -FilePath $PowerShellExe -Arguments @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $builder,
    "-WorkbookPath", $ResolvedWorkbookPath,
    "-OutputPath", "data\dashboard-data.json"
  ) | Out-Null

  $jsonPath = Join-Path $ProjectRoot "data\dashboard-data.json"
  if (-not (Test-Path -LiteralPath $jsonPath)) {
    throw "Arquivo JSON nao foi gerado: $jsonPath"
  }

  if ($SkipGit) {
    Write-Log "Modo teste ativo: geracao concluida sem commit/push."
    Write-Log "Fim da automacao com sucesso."
    Wait-BeforeExit
    exit 0
  }

  Invoke-LoggedCommand -FilePath $GitExe -Arguments @("status", "--short", "--branch") | Out-Null

  $changed = & $GitExe status --porcelain -- data/dashboard-data.json
  if ([string]::IsNullOrWhiteSpace($changed)) {
    Write-Log "Nenhuma mudanca em data/dashboard-data.json. Nada para commitar."
    Write-Log "Fim da automacao sem alteracoes."
    Wait-BeforeExit
    exit 0
  }

  Invoke-LoggedCommand -FilePath $GitExe -Arguments @("add", "data/dashboard-data.json") | Out-Null
  Invoke-LoggedCommand -FilePath $GitExe -Arguments @("commit", "-m", $CommitMessage) | Out-Null
  Invoke-LoggedCommand -FilePath $GitExe -Arguments @("push", "origin", $Branch) | Out-Null

  Write-Log "JSON atualizado, commitado e enviado para origin/$Branch."
  Write-Log "Fim da automacao com sucesso."
} catch {
  Write-Log ("ERRO: " + $_.Exception.Message)
  Write-Log ("LINHA: " + $_.InvocationInfo.ScriptLineNumber)
  Write-Log ("COMANDO: " + $_.InvocationInfo.Line.Trim())
  Write-Log "Fim da automacao com erro."
  Write-Host ""
  Write-Host "ERRO NA AUTOMACAO."
  Wait-BeforeExit
  exit 1
}

Wait-BeforeExit
