# Configuração do Supabase

## 1. Criar e vincular o projeto

Crie um projeto dedicado e escolha uma região adequada à operação. Guarde a senha do banco e as chaves administrativas em um gerenciador de segredos.

Vincule o repositório pela Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase migration list --linked
```

## 2. Aplicar o banco

As migrations em `supabase/migrations` devem ser executadas em ordem cronológica. O conjunto atual cobre:

- esquema principal de sites e casos;
- segurança, RLS e auditoria;
- funções transacionais e Storage privado;
- colaboradores e catálogo documental;
- etapas do fluxo de acesso;
- indicadores e catálogo de sites;
- documentação patronal;
- mapa e payload geográfico;
- proteções de vínculo entre casos e colaboradores;
- autenticação por link mágico;
- cópia segura de checklist documental.

Para aplicar e conferir:

```powershell
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db lint --linked
```

As migrations criam tabelas, índices, políticas RLS, auditoria, funções e o bucket privado `case-documents`.

## 3. Configurar autenticação

Em **Authentication**:

1. mantenha o provedor de e-mail ativo;
2. mantenha a criação de usuários habilitada, pois o link mágico provisiona
   contas automaticamente (`shouldCreateUser: true`); o controle de domínios
   permanece no banco, via `allowed_portal_email_domains` e no gatilho de
   criação de usuário;
3. configure o domínio de produção e os redirects;
4. configure o template de link mágico e um SMTP corporativo.

Consulte [acesso-por-codigo.md](./acesso-por-codigo.md) para os valores e testes completos.

Não é preciso criar usuários manualmente para `@claro.com.br` e
`@eqsengenharia.com.br`: o primeiro acesso pelo link mágico cria a conta e o
perfil. O papel é definido pelo domínio (`@eqsengenharia.com.br` vira
`operacao_eqs`; `@claro.com.br` vira `cliente_claro`).

Para usuários já existentes no Auth sem perfil em `app_users`, a migration
`202608120017_domain_role_auto_provision.sql` completa o backfill. Ajustes
pontuais continuam possíveis:

```sql
update public.app_users
set role = 'operacao_eqs'
where email = 'email-do-operador@eqsengenharia.com.br';
```

Após o primeiro acesso por link mágico, o portal permite que o usuário defina
uma senha e passe a entrar com **Login + Senha**. A migration
`202608120018_current_user_has_password.sql` cria a função
`current_user_has_password()` usada pelo frontend para saber quando exibir a
etapa de criação de senha.

## 4. Conectar o frontend

Copie `.env.example` para `.env.local` e preencha os valores públicos encontrados em **Project Settings > API**:

```text
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=CHAVE-PUBLICA-ANON
VITE_MAPTILER_KEY=CHAVE-PUBLICA-RESTRITA-POR-DOMINIO
```

`VITE_MAPTILER_KEY` é opcional. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em `.env.local`, no código React ou no GitHub Pages.

## 5. Conferir a instalação

Use o SQL Editor para uma verificação inicial:

```sql
select count(*) as sites from public.sites;
select count(*) as casos from public.access_cases;
select count(*) as colaboradores from public.collaborators;
select count(*) as eventos from public.case_events;
```

Confirme também que:

- um cliente consegue consultar somente os dados autorizados;
- um operador consegue executar as ações previstas;
- o bucket `case-documents` não permite leitura pública;
- alterações relevantes aparecem na trilha de auditoria;
- as URLs locais e de produção retornam corretamente após o login.

## 6. Carga de colaboradores

Gere os arquivos de importação a partir da planilha:

```powershell
npm.cmd run import:employees -- --workbook "C:\caminho\FUNCIONARIOS.xlsx" --output data/import
npm.cmd run check:employees
```

Carregue os dados usando a chave administrativa apenas na sessão do terminal:

```powershell
$env:SUPABASE_URL = "https://SEU-PROJETO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Cole a chave service_role"
npm.cmd run load:employees
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
```

Os arquivos gerados em `data/import` e as credenciais locais não devem ser versionados.
