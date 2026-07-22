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
2. desabilite cadastros públicos;
3. configure o domínio de produção e os redirects;
4. configure o template de link mágico e um SMTP corporativo.

Consulte [acesso-por-codigo.md](./acesso-por-codigo.md) para os valores e testes completos.

Crie o primeiro usuário em **Authentication > Users**. O gatilho cria o perfil de leitura. Promova somente os operadores autorizados:

```sql
update public.app_users
set role = 'operacao_eqs'
where email = 'email-do-operador@eqsengenharia.com.br';
```

Usuários da Claro permanecem com `cliente_claro`, salvo uma decisão explícita de governança.

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
