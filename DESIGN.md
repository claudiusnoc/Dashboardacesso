# Design System

## Register

design

## Product

Dashboard executivo **Pendências de Acesso Claro MG**, voltado para reunião gerencial com lideranças da Claro S.A. e EQS Engenharia.

O sistema visual deve comunicar controle operacional, urgência bem organizada e leitura rápida em projetor. O dashboard não deve parecer planilha, BI genérico ou peça decorativa; a prioridade é transformar pendências em decisão e próximo passo.

## Source of Truth

| Fonte | Arquivo | Decisão de design |
|---|---|---|
| Manual oficial Claro | `Manual-Da-Marca-CLARO.pdf` | Marca, cores oficiais, tipografia, usos proibidos, proteção e redução mínima |
| Documento de produto | `PRODUCT.md` | Objetivo, usuários, regras de conteúdo, tratamento dos assets e restrições |
| Dashboard atual | `dashboard.html` | Tokens CSS e padrões de componentes já implementados |
| Logo Claro | `Claro Logo - 3000x3000.png` / `assets/claro-logo.png` | Marca principal |
| Logo EQS | `EQS ENGENHARIA LOGO.png` / `assets/eqs-logo.png` / `assets/eqs-logo.jpg` | Assinatura parceira/operacional |
| Fundo MG | `FUNDO MG.png` / `assets/fundo-mg.png` | Contexto territorial, sempre subordinado aos dados |

## Visual Position

Executivo, claro, denso e confiável. A tela precisa funcionar em três leituras:

1. **5 segundos:** volume geral, criticidade e bloqueios principais.
2. **30 segundos:** responsáveis, categorias e prioridades.
3. **3 minutos:** detalhes operacionais suficientes para encaminhamento.

O visual deve usar contraste forte, hierarquia evidente, números grandes e tabelas legíveis. Qualquer ornamento deve ajudar a localização, status ou compreensão.

## Brand Tokens

### Official Claro tokens

```css
:root {
  --claro: #D52B1E;
  --claro-strong: #A8201A;
  --claro-soft: rgba(213, 43, 30, .10);
  --cinza-claro: #ADAFAF;
  --preto: #000000;

  --font-display: "DIN Alternate", "DIN", Arial, sans-serif;
  --font-ui: Arial, sans-serif;
}
```

### Dashboard working tokens

```css
:root {
  --page: #f0f3f7;
  --surface: #ffffff;
  --surface-soft: #fbfcfe;
  --ink: #111827;
  --ink-2: #263244;
  --muted: #56637a;
  --quiet: #7c8799;
  --line: #dfe4ec;
  --line-soft: #edf0f5;

  --eqs: #151923;
  --eqs-soft: #eef1f5;
  --navy: #151923;

  --blue: #285a9c;
  --blue-soft: #eaf1fb;
  --green: #157a52;
  --green-soft: #e9f7f0;
  --amber: #b86e0d;
  --amber-soft: #fff3dc;
  --slate: #667085;
  --slate-soft: #f0f3f7;

  --radius: 14px;
  --radius-sm: 10px;
  --shadow-tight: 0 4px 8px rgba(17, 24, 39, .06);
  --focus: 0 0 0 3px rgba(213, 43, 30, .22);
  --ease-out: cubic-bezier(.22, 1, .36, 1);
}
```

### Color discipline

- `--claro` é o acento de marca e deve aparecer com parcimônia: KPI crítico, estado ativo, link de ação ou destaque executivo.
- `--eqs`/`--navy` sustenta estrutura, barras, áreas de cabeçalho e contraste institucional.
- `--blue`, `--green`, `--amber` e `--slate` são cores semânticas para categoria/status; não competem com a marca.
- Evitar roxo, violeta, gradientes azul/roxo, paletas de BI genéricas e fundos bege/laranja.
- Todo estado colorido deve ter rótulo textual; cor nunca é o único sinal.

## Typography

### Font roles

| Papel | Fonte | Uso |
|---|---|---|
| Display | `"DIN Alternate", "DIN", Arial, sans-serif` | Título, KPIs, números de impacto, cabeçalhos fortes |
| UI/body | `Arial, sans-serif` | Navegação, tabela, filtros, labels, textos operacionais |
| Numerais | Herda UI com `font-variant-numeric: tabular-nums` | KPIs, quantidades, prazos e tabelas |

### Scale

| Papel | Tamanho recomendado | Observação |
|---|---:|---|
| KPI principal | 44-64px | Precisa ser legível em projetor |
| Título de página | 32-44px | Usar tracking levemente negativo |
| Título de seção | 22-30px | Separar blocos sem competir com KPI |
| Corpo/tabela | 15-18px | Nunca reduzir para caber excesso de texto |
| Labels/captions | 12-14px | Usar tracking positivo em caixa alta |

### Typography rules

- Usar `letter-spacing: 0` no corpo.
- Usar `letter-spacing: -0.01em` a `-0.02em` em títulos grandes.
- Usar `letter-spacing: .06em` a `.08em` em labels em caixa alta.
- Limitar linhas longas a cerca de 65 caracteres.
- Evitar peso 700 em excesso; reservar negrito forte para título, KPI e prioridade.

## Layout System

### Grid and spacing

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
}
```

- Usar largura máxima de `1440px` para o canvas principal.
- Priorizar grid responsivo com módulos executivos no topo e detalhe operacional abaixo.
- O primeiro viewport deve mostrar: marcas, título, KPIs essenciais e navegação/atalhos de análise.
- Evitar sequências de cards iguais; variar peso visual por criticidade, status e densidade de informação.
- Tabelas devem usar linhas finas, alinhamento numérico e altura confortável para leitura em projetor.

## Components

### Topbar

- Deve ser fixa/sticky, discreta e legível sobre o fundo.
- Pode usar superfície translúcida com blur, desde que o contraste do texto permaneça forte.
- Claro e EQS devem ter hierarquia: Claro como marca principal do contexto; EQS como execução/parceria.
- Respeitar respiro em volta de logos. Não encostar em bordas, divisórias ou outros elementos.

### KPI cards

- Um KPI dominante deve conduzir a leitura.
- KPIs críticos podem usar vermelho Claro, mas com rótulo textual e contexto.
- Numerais devem usar `tabular-nums`.
- Evitar sombra pesada; usar borda, contraste e escala.

### Status pills

- Pills devem combinar cor + texto.
- Vermelho: criticidade/bloqueio.
- Âmbar: atenção, prazo ou pendência em tratamento.
- Verde: concluído/regularizado.
- Azul: informação/fluxo administrativo.
- Cinza: neutro/a confirmar.

### Tables and lists

- Tabelas são parte central do produto, não rodapé.
- Colunas precisam responder às perguntas: quem, onde, qual bloqueio, status, responsável e próximo passo.
- Em telas menores, transformar linhas em blocos escaneáveis, não espremer todas as colunas.
- Não esconder dados críticos apenas em tooltip.

### Filters and interactions

- Filtros devem ter estado ativo evidente.
- Botões precisam ter foco visível por `--focus`.
- Ações de cópia, filtro, expansão e navegação devem dar feedback claro.
- Evitar controles que pareçam ferramenta de designer ou seletor de viewport; toda navegação precisa ser navegação real do produto.

## Asset Rules

### Claro logo

- Usar o asset oficial sem redesenhar, recolorir, contornar, aplicar sombra ou deformar.
- Respeitar área de proteção definida pelo manual.
- Não usar abaixo da redução mínima equivalente a `1cm` em exportações.
- Sobre mapa ou imagem, aplicar superfície de apoio quando a leitura estiver ameaçada.

### EQS logo

- Usar como assinatura parceira/operacional.
- Preferir versão horizontal quando houver largura.
- Usar símbolo compacto apenas quando o espaço for restrito.
- Não competir visualmente com a marca Claro nem com os KPIs.

### Minas Gerais background

- `FUNDO MG.png` / `assets/fundo-mg.png` é contexto territorial, não fundo decorativo livre.
- Usar com opacidade reduzida, overlay, blur leve ou camada sólida sob texto.
- Nunca colocar texto crítico diretamente sobre área complexa do mapa.
- O mapa não define a paleta; ele deve ficar subordinado a Claro vermelho + neutros.

## Responsive Behavior

### Desktop / reunião

- Otimizar para 1366px, 1440px e projetor.
- KPIs e títulos precisam resistir à distância da sala.
- Evitar textos pequenos em tabelas densas; preferir resumo + drilldown visual.

### Tablet

- Manter KPIs no topo e reorganizar detalhes em duas colunas.
- Navegação deve permanecer acessível sem hover.
- Alvos interativos devem ter pelo menos 44px.

### Mobile

- O mobile é consulta operacional, não apresentação principal.
- Priorizar: resumo, filtros rápidos, lista de pendências e detalhes expansíveis.
- Tabelas devem virar cards informativos.
- Não reduzir fonte a ponto de comprometer leitura.

## Accessibility

- Contraste mínimo de texto normal: 4.5:1.
- Contraste de componentes e focos: 3:1.
- Estados críticos precisam de rótulo textual.
- Elementos interativos devem ser alcançáveis por teclado.
- Usar `:focus-visible` com `--focus`.
- Respeitar `prefers-reduced-motion` para transições transform/scale.
- Imagens de logo devem ter `alt` claro; imagens decorativas devem ser tratadas como decorativas.

## Motion

Motion deve confirmar estado, não decorar.

- Hover/focus: 100-150ms.
- Expansão, filtro e troca de aba: 150-250ms.
- Evitar animações contínuas em ambiente de reunião.
- Não usar shimmer, confete, blobs, glow decorativo ou coreografias de hero.
- Para atenção crítica, usar contraste e rótulo antes de animação.

## Content and Data Rules

- Métricas devem vir de `ACESSO PENDENCIAS.xlsx` ou fonte confirmada.
- Não inventar percentuais, rankings, prazos, status ou ganho operacional.
- Ausência de dado deve aparecer como `sem informação`, `a confirmar` ou vazio tratado visualmente.
- Microcopy deve ser direta: `Pendente`, `Em tratativa`, `Bloqueado`, `A confirmar`, `Concluído`.
- Evitar linguagem técnica que só o time operacional entenda se a tela for para reunião gerencial.

## Anti-patterns

- Cards iguais em grade sem prioridade.
- Logo Claro com sombra, contorno, distorção, baixa legibilidade ou cor alterada.
- Texto sobre mapa sem camada de contraste.
- Vermelho aplicado em todos os elementos.
- Gradiente decorativo sem função.
- Ícones genéricos em excesso.
- Tabela espremida com fonte pequena.
- Controles de demonstração, seletor de plataforma ou painel de design dentro do produto.
- Métricas sem origem comprovada.

## Quality Checklist

Antes de publicar uma revisão:

- A marca Claro está correta, legível e com respiro.
- O vermelho Claro aparece como acento, não como ruído.
- O primeiro viewport responde ao estado geral das pendências.
- KPIs são legíveis em projetor.
- Tabelas e listas mostram responsável, bloqueio, status e próximo passo.
- Dados ausentes não foram inventados.
- O fundo de MG não prejudica contraste.
- Foco de teclado está visível.
- O layout não tem rolagem horizontal em mobile.
- Acentos e cedilha aparecem corretamente em UTF-8.
