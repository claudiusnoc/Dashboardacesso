# Portal de Acessos | Claro MG

Aplicação interna para centralizar demandas de acesso a sites da Claro em Minas Gerais, com acompanhamento do fluxo operacional, colaboradores, documentação, mapa e trilha auditável.

**Versão atual:** `0.2.0`

**Portal:** [claudiusnoc.github.io/Dashboardacesso](https://claudiusnoc.github.io/Dashboardacesso/)

## Visão geral

O portal substitui o antigo dashboard estático por uma aplicação React integrada ao Supabase. Os dados operacionais ficam no PostgreSQL, protegidos por autenticação, papéis de acesso e políticas RLS. O frontend mantém localmente apenas preferências individuais de interface e caches temporários.

### Principais recursos

- Entrada com senha corporativa ou link mágico enviado por e-mail.
- Perfis separados para operação EQS e cliente Claro.
- Gestão de casos em cartões ou lista, com busca, filtros e paginação.
- Fluxo operacional em cinco etapas, da identificação do bloqueio à liberação do acesso.
- Cadastro guiado de casos e associação de sites.
- Detalhamento do caso com colaboradores, eventos e documentação.
- Checklists individuais e patronais, incluindo documentos personalizados.
- Catálogo e indicadores por tipologia de site.
- Mapa interativo MapLibre com filtros, KPIs e visualização de rua ou satélite.
- Auditoria das alterações relevantes no banco.

## Perfis e rotas

| Perfil          | Permissões principais                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| `operacao_eqs`  | Consulta e manutenção de casos, sites, colaboradores e documentos.                  |
| `cliente_claro` | Consulta autorizada do portal, com dados sensíveis e ações operacionais protegidos. |

| Rota             | Finalidade                      | Acesso       |
| ---------------- | ------------------------------- | ------------ |
| `/login`         | Autenticação                    | Pública      |
| `/casos`         | Painel e lista de demandas      | Autenticado  |
| `/casos/:id`     | Detalhes, fluxo e documentação  | Autenticado  |
| `/novo`          | Criação de caso                 | Operação EQS |
| `/sites`         | Catálogo e indicadores de sites | Autenticado  |
| `/mapa-sites`    | Mapa interativo                 | Autenticado  |
| `/colaboradores` | Gestão de colaboradores         | Operação EQS |

As permissões efetivas não dependem apenas da interface: o Supabase também aplica as regras no banco, nas funções e no Storage.

## Tecnologia

- React 18 e React Router 7
- Vite 6
- Supabase Auth, PostgreSQL, RLS, RPC e Storage
- MapLibre GL e MapTiler opcional
- Recharts
- Lucide React
- Archivo e Barlow

## Arquitetura e persistência

```text
Navegador
  └─ React + Vite
      ├─ Supabase Auth
      ├─ PostgreSQL com RLS e funções transacionais
      └─ Storage privado para documentos
```

Casos, sites, colaboradores, documentos, etapas do fluxo e auditoria são persistidos no Supabase. O navegador usa armazenamento local somente para preferências por usuário — como modo de exibição e filtros — e para caches de curta duração que podem ser reconstruídos.

## Executar localmente

### Pré-requisitos

- Node.js 20 ou superior; Node.js 22 é recomendado.
- npm.
- Um projeto Supabase preparado com as migrations deste repositório.

### Instalação

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Abra [http://127.0.0.1:5177](http://127.0.0.1:5177).

Preencha `.env.local` antes de iniciar:

| Variável                 | Obrigatória | Uso                                                                       |
| ------------------------ | ----------- | ------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Sim         | URL pública do projeto Supabase.                                          |
| `VITE_SUPABASE_ANON_KEY` | Sim         | Chave pública `anon` usada pelo frontend com RLS.                         |
| `VITE_MAPTILER_KEY`      | Não         | Camada de mapa MapTiler; sem ela, o portal usa o mapa aberto configurado. |

Variáveis com prefixo `VITE_` fazem parte do bundle entregue ao navegador. Restrinja a chave MapTiler aos domínios autorizados e nunca use uma chave `service_role` no frontend.

## Configurar o Supabase

As migrations em [`supabase/migrations`](./supabase/migrations) devem ser aplicadas em ordem cronológica. Elas criam o modelo principal, segurança, auditoria, funções, Storage, fluxo de casos, colaboradores, documentos e catálogo geográfico.

Fluxo recomendado pela CLI:

```powershell
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase migration list --linked
npx supabase db push --linked
npx supabase db lint --linked
```

Além das migrations, configure no painel do Supabase:

- provedor de e-mail e SMTP;
- usuários autorizados;
- URL principal e redirects de autenticação;
- domínio de produção `https://claudiusnoc.github.io/Dashboardacesso/`;
- redirect `https://claudiusnoc.github.io/Dashboardacesso/casos` para o link mágico.

Veja os guias detalhados:

- [Configuração do Supabase](./docs/supabase-setup.md)
- [Autenticação por senha ou link mágico](./docs/acesso-por-codigo.md)
- [Notas de implementação](./docs/implementation-notes.md)

## Carga inicial de colaboradores

O importador recebe a planilha de origem por argumento, sem caminhos pessoais gravados no projeto:

```powershell
npm.cmd run import:employees -- --workbook "C:\caminho\FUNCIONARIOS.xlsx" --output data/import
npm.cmd run check:employees
```

Para enviar a carga ao Supabase, defina as credenciais somente na sessão do terminal:

```powershell
$env:SUPABASE_URL = "https://SEU-PROJETO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Cole a chave service_role"
npm.cmd run load:employees
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
```

Não grave `SUPABASE_SERVICE_ROLE_KEY` em arquivos do frontend, commits ou logs.

## Build e publicação

Build de produção:

```powershell
npm.cmd run build
```

O build já usa o subdiretório `/Dashboardacesso/` do GitHub Pages e cria `dist/404.html`, usado como fallback para abrir rotas internas diretamente. O servidor de desenvolvimento continua disponível na raiz local.

A publicação é automatizada pelo workflow [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml). Cada push em `main`:

1. instala as dependências com `npm ci`;
2. gera o bundle com base `/Dashboardacesso/`;
3. envia o conteúdo de `dist` ao GitHub Pages.

O repositório precisa ter estas variáveis configuradas em **Settings > Secrets and variables > Actions**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MAPTILER_KEY` (opcional)

## Segurança

- O link mágico provisiona automaticamente contas para e-mails corporativos autorizados (`shouldCreateUser: true`).
- O papel é atribuído pelo domínio: `@eqsengenharia.com.br` vira `operacao_eqs` (acesso total) e `@claro.com.br` vira `cliente_claro` (consulta autorizada).
- Domínios fora da lista são recusados no banco pelo gatilho de criação de usuário.
- Após o primeiro acesso por link mágico, o usuário define uma senha própria e pode entrar com login e senha.
- A chave pública do Supabase não substitui RLS: políticas e funções do banco são a barreira de autorização.
- Documentos ficam em bucket privado, com acesso controlado.
- Arquivos `.env*`, artefatos de build e dados temporários de importação são ignorados pelo Git.

## Estrutura do projeto

```text
src/                 aplicação React e componentes
assets/              marcas e recursos visuais empacotados
supabase/             configuração e migrations do banco
scripts/              importação, validação e utilitários de build
docs/                 guias operacionais e técnicos
.github/workflows/    publicação automatizada no GitHub Pages
```

## Uso e propriedade

Projeto de uso interno e restrito. Nenhuma licença de redistribuição foi declarada.
