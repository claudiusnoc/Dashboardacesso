# Brand Spec — Claro S.A.

Extraído do **Manual de Aplicação de Marcas Claro** (32 páginas).

## Paleta oficial

### Cores base

| Cor | Hex | RGB | CMYK | Pantone |
|---|---|---|---|---|
| Vermelho Claro | `#D52B1E` | R:213 G:43 B:30 | C:0 M:93 Y:95 K:0 | 485 C / 485 U |
| Cinza Claro | `#ADAFAF` | R:173 G:175 B:175 | C:18 M:11 Y:8 K:23 | Cool Gray 6C / 6U |
| Preto | `#000000` | R:0 G:0 B:0 | C:40 M:30 Y:30 K:100 | Black C / U |

### Derivações para o dashboard

| Token | Valor | Uso |
|---|---|---|
| `--claro` | `#D52B1E` | Acento principal — KPI, pills críticas, links de ação |
| `--claro-strong` | `#A8201A` | Hover/active do acento (10% mais escuro) |
| `--claro-soft` | `rgba(213, 43, 30, .10)` | Fundo sutil de alerta, badges |
| `--cinza` | `#ADAFAF` | Borders secundários, ícones neutros |
| `--preto` | `#000000` | Texto de alto contraste quando necessário |

## Tipografia

| Contexto | Fonte | Pesos |
|---|---|---|
| Print / materiais impressos | DIN Alternate | Regular, Medium, Bold |
| Digital / web | Arial | Regular, Bold |

### No dashboard

```css
--font-display: "DIN Alternate", "DIN", Arial, sans-serif;
--font-ui: Arial, sans-serif;
```

## Usos proibidos ( Manual da Marca, §1.3)

1. Não substituir a versão tipográfica da marca pelo logotipo
2. Não usar efeitos de sombra no logotipo
3. Não inclinar o logotipo
4. Não usar contornos no logotipo
5. Não alterar cores dos elementos da marca
6. Não deformar o logotipo
7. Não alterar proporções dos elementos
8. Não alterar tipografia do logotipo
9. Não usar a marca sobre fundos que dificultem legibilidade

## Área de proteção

A marca possui área de proteção definida por `x` (unidade derivada do logo circular). Aplicações devem respeitar margens mínimas de `1cm` em todos os lados.

## Pictogramas oficiais

Três pictogramas complementam a comunicação: **tv/hdtv**, **fixo/fone**, **móvel/celular**. Devem ser usados conforme o manual, não substituídos por ícones genéricos.
