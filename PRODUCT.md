# Product

## Register

product

## Users

Gestores e lideranças da Claro S.A. e da EQS Engenharia que precisam entender rapidamente o status das demandas de acesso a sites críticos em Minas Gerais. O uso principal acontece em reunião gerencial, com necessidade de leitura simples, direta e confiável, inclusive em tela projetada.

## Product Purpose

O dashboard apresenta um controle executivo das pendências de acesso a detentoras, torres, mineradoras, aeroportos, hospitais e outros sites burocráticos da Claro MG. Ele existe para demonstrar que as demandas estão mapeadas, em tratamento ativo e com bloqueios claros para apoio gerencial.

O produto não é uma planilha visual. Ele deve transformar backlog operacional em leitura executiva: volume, gravidade, responsáveis, próximos passos e pontos que precisam de destravamento.

## Source Assets Consulted

| Fonte | Arquivo | Uso no produto |
|---|---|---|
| Manual oficial Claro | `Manual-Da-Marca-CLARO.pdf` | Cores, tipografia, usos proibidos, proteção/redução da marca, pictogramas e hierarquia da marca Claro |
| Logo Claro | `Claro Logo - 3000x3000.png` | Marca principal do dashboard; asset quadrado em alta resolução com transparência |
| Logo EQS horizontal | `EQS ENGENHARIA LOGO.png` | Assinatura institucional da EQS como apoio/parceiro operacional |
| Símbolo EQS | `logo eqs 2.jpg` | Uso secundário quando uma marca compacta for necessária |
| Fundo Minas Gerais | `FUNDO MG.png` | Contexto territorial da apresentação; deve ficar subordinado à leitura dos dados |

## Brand Identity (Manual da Marca Claro)

### Cores oficiais

| Cor | Hex | RGB | CMYK | Pantone |
|---|---|---|---|---|
| Vermelho Claro | `#D52B1E` | R:213 G:43 B:30 | C:0 M:93 Y:95 K:0 | 485 C / 485 U |
| Cinza Claro | `#ADAFAF` | R:173 G:175 B:175 | C:18 M:11 Y:8 K:23 | Cool Gray 6C / 6U |
| Preto | `#000000` | R:0 G:0 B:0 | C:40 M:30 Y:30 K:100 | Black C / U |

### Derivações do dashboard

| Token | Uso | Valor |
|---|---|---|
| `--claro` | Acento principal, KPI, pills críticas, links de ação | `#D52B1E` |
| `--claro-strong` | Hover do acento, estado ativo, texto vermelho com maior contraste | `#A8201A` |
| `--claro-soft` | Fundo sutil de alerta, badges e ênfase leve | `rgba(213, 43, 30, .10)` |
| `--cinza-claro` | Bordas secundárias, linhas de apoio, divisórias discretas | `#ADAFAF` |
| `--preto` | Texto de alto contraste e elementos de leitura crítica | `#000000` |
| `--focus` | Anel de foco acessível | `0 0 0 3px rgba(213, 43, 30, .22)` |

### Regras de uso de cor

- O vermelho Claro deve ser o acento dominante da marca, não uma cor decorativa repetida em todos os cards.
- Cinza e preto sustentam a leitura; o dashboard pode usar neutros escuros para contraste em projetor, desde que o vermelho oficial continue reconhecível.
- Estados críticos podem usar vermelho, mas sempre acompanhados por texto ou rótulo. Não depender apenas da cor.
- Evitar gradientes roxo/azul, paletas genéricas de BI e fundos muito coloridos competindo com KPIs.

### Tipografia oficial

| Contexto | Fonte | Pesos |
|---|---|---|
| Materiais de comunicação | DIN Alternate / DIN | Regular, Medium, Bold |
| Digital / web | Arial | Regular, Bold |

**No dashboard:** `--font-display: "DIN Alternate", "DIN", Arial, sans-serif` e `--font-ui: Arial, sans-serif`.

Quando a DIN não estiver disponível no computador de apresentação, Arial deve assumir sem quebrar layout. Títulos e KPIs podem usar DIN/Arial Bold; corpo, tabelas e labels devem priorizar legibilidade.

### Marca Claro

- A marca principal Claro deve constar nos materiais de comunicação dos produtos derivados da marca Claro.
- O manual mostra duas formas de aplicação: logo circular e logo escrito. Para este dashboard, a leitura institucional deve privilegiar a marca Claro como assinatura principal, sem reconstruir ou redesenhar o logotipo.
- Respeitar a área de proteção definida por `x` ao redor da marca.
- Respeitar redução máxima indicada no manual: não aplicar a marca com menos de `1cm` de largura/altura equivalente no contexto impresso ou exportado.
- Em telas projetadas, não usar o logo pequeno demais; ele deve ser reconhecível sem disputar atenção com o título e os KPIs.

### Usos proibidos (manual, seção 1.3)

- Não substituir a versão tipográfica da Claro pelo logotipo circular quando o contexto exigir a marca escrita.
- Não construir marca composta indevida entre Claro e submarcas/produtos.
- Não usar efeitos de sombra no logotipo.
- Não inclinar o logotipo.
- Não usar contornos no logotipo.
- Não alterar cores dos elementos da marca.
- Não deformar o logotipo.
- Não alterar proporções dos elementos.
- Não alterar tipografia do logotipo.
- Não usar a marca sobre fundos que dificultem legibilidade.

### Pictogramas oficiais

O manual define três pictogramas de produto: `tv / hdtv`, `fixo / fone` e `móvel / celular`. Eles complementam comunicação de produtos Claro, mas não devem ser trocados por ícones genéricos quando a intenção for representar uma linha oficial de produto.

Para este dashboard de pendências de acesso, pictogramas devem ser usados com parcimônia. Se a informação for operacional, preferir rótulos claros, status e categorias de acesso em vez de iconografia decorativa.

## Asset Treatment

### Logo Claro

- Usar o asset oficial sem recolorir, distorcer, contornar ou aplicar sombra.
- Manter respiro visual ao redor do logo; não encostar em bordas, cards, linhas ou outros logos.
- Sobre imagem ou mapa, aplicar fundo/superfície de suporte se houver risco de perda de legibilidade.

### Logo EQS

- A EQS aparece como marca parceira/operacional, subordinada à hierarquia da Claro no contexto da apresentação.
- Usar o logo horizontal quando houver largura suficiente; usar o símbolo compacto apenas em espaços reduzidos.
- Não aplicar efeitos que façam a EQS competir com o vermelho Claro ou com os KPIs.

### Fundo Minas Gerais

- A imagem `FUNDO MG.png` é um bom contexto territorial por mostrar Minas Gerais em destaque topográfico.
- Usar como camada de ambientação, não como ilustração principal quando houver dados sobrepostos.
- Sempre aplicar overlay, escurecimento, blur leve ou área sólida atrás de textos para manter contraste.
- Evitar que o verde/marrom/azul do mapa vire a paleta do produto; a paleta oficial continua sendo Claro vermelho + neutros.

## Brand Personality

Executivo, objetivo e confiável. O produto deve transmitir controle, organização e prontidão para destravar problemas, sem parecer planilha, BI genérico ou peça decorativa.

O tom visual deve ser de sala de reunião: leitura rápida, dados verificáveis, foco em ação e pouca ornamentação. O dashboard pode ser moderno, mas a modernidade deve aparecer em hierarquia, espaçamento, contraste e interação, não em efeitos decorativos.

## Anti-references

Não deve parecer Excel, Power BI genérico, relatório fraco, grade de cards repetitivos ou página bonita demais sem utilidade operacional. Evitar excesso de texto, visual pesado, gráficos decorativos e linguagem técnica demais para reunião.

Também evitar:

- Cards iguais em sequência sem prioridade visual.
- Métricas inventadas ou sem origem na planilha.
- Ícones genéricos em excesso.
- Gradientes decorativos sem função.
- Tipografia pequena para projetor.
- Logo aplicado sobre fundo complexo sem área de proteção.

## Design Principles

- Mostrar controle antes do detalhe.
- Transformar pendência em próxima ação.
- Priorizar leitura executiva em poucos segundos.
- Manter a base operacional acessível sem dominar a tela.
- Usar visual moderno com sobriedade, sem sacrificar clareza.
- Respeitar estritamente o Manual da Marca Claro: cores oficiais, tipografia DIN/Arial, usos proibidos, área de proteção e redução mínima.
- Tratar a Claro como marca principal e a EQS como assinatura de execução/parceria.
- Usar o mapa de Minas Gerais para contexto, nunca para prejudicar contraste.
- Separar criticidade, prazo, responsável e bloqueio de forma legível.

## Data & Content Rules

- Os números do dashboard devem vir da planilha `ACESSO PENDENCIAS.xlsx` ou de fonte explicitamente confirmada pelo usuário.
- Não inventar percentuais, prazos, rankings ou status para preencher espaço.
- Quando houver dado ausente, mostrar ausência de forma honesta: `sem informação`, `a confirmar` ou campo vazio tratado visualmente.
- Cada módulo deve deixar claro se a informação é resumo executivo, lista operacional, bloqueio, prioridade ou próxima ação.

## Accessibility & Inclusion

Priorizar contraste forte, texto legível em projetor, navegação simples por teclado, estados de foco visíveis, layout responsivo e uso de cor acompanhado por texto para não depender apenas de percepção cromática.

Regras práticas:

- Texto principal e KPIs devem permanecer legíveis em projetor.
- Estados críticos precisam de rótulo textual além da cor.
- Elementos interativos devem ter foco visível.
- Não colocar texto diretamente sobre mapa/foto sem camada de contraste.
- Evitar corpos de texto longos; quando necessário, limitar largura e aumentar entrelinha.

