# Painel do site selecionado

Extensão local do mapa, modo Operate. Fontes: `src/components/SiteMapDetailPanel.jsx`, `src/components/SiteMapDetailPanel.css`; estrutura/fontes herdadas: `src/styles.css`; ícone/cor da tipologia: `src/components/SiteTypeIcon.jsx`.

## Hierarquia e conteúdo

O cabeçalho reúne ícone de tipologia, código do site, município e botão de fechar (44 × 44px, nome acessível). Escape fecha o painel quando o foco está nele. A faixa seguinte une prioridade e quantidade de estações que o site carrega, com divisor discreto. Nível 0 recebe fundo vermelho suave e texto “Prioridade · Crítico”; níveis 1–5 conservam o tratamento neutro.

“Equipe responsável” mostra nomes completos, iniciais e ordinal do campo de origem (1, 2 ou 3), sem inferir titular ou suplente. Tipologia normalizada, detentora e cluster EQS precedem endereço e CEP disponível. “Dados complementares” conserva nome completo, nome Smart Plan quando distinto, tipologia original e coordenadas com seis casas decimais.

As expansões usam `details`/`summary` nativos. Dados complementares começam fechados; casos vinculados abrem automaticamente quando há casos reais, exibindo nome, status e link para `/casos/:id`. Sem casos, a expansão informa “Nenhum caso vinculado”. Campos ausentes apresentam “Não informado”; `0` permanece visível e valores textuais de carga preservam o conteúdo original, aparando apenas espaços externos. Carregamento e erro usam anúncio de status/alerta.

## Aparência e adaptação

Texto principal (#172033), secundário (#59677d), linhas (#e2e7ee), faixa neutra (#f3f5f8), crítico (#a8201a sobre #fcecea) e superfície branca (#fff). Contadores usam #344054 sobre #edf1f6; avatares, #e9eef4. Título: DIN Alternate/DIN/Arial, peso 700, 1.65rem/1.1; prioridade: 1.35rem/1.15. Seções: Arial/Helvetica Neue, 700, 0.9375rem/1.3; nomes/endereço: 0.875rem; rótulos: 0.75rem.

Até 400px no desktop; até 340px em ≤940px; em ≤760px, folha inferior com largura 100% e altura herdada `min(70dvh, 620px)`. Cabeçalho estável; conteúdo rola internamente, respeitando a área segura inferior. Foco visível e movimento reduzido atendidos.

## Validação e disposição

Evidência fornecida pela implementação: Vite build e fallback SPA concluídos (exit 0). `design-previews/verify-site-detail.mjs` passou no Edge/Playwright: desktop 1440×1000 e mobile 390×844 sem overflow horizontal; três técnicos; nível 5 neutro/0 crítico; expansão por Enter; coordenadas; carga “2 + localidade”; nome longo; ausências; link de caso; fechamento; loading/erro; nenhum pageerror. Capturas: `design-previews/site-detail-{desktop,mobile,critical,expanded}.png`. Detector: `[]`. Revisão: ship, sem achados materiais no painel.
