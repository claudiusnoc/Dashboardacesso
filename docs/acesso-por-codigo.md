# Autenticação por senha ou link mágico

O portal oferece duas formas de entrada para usuários previamente autorizados:

- **Senha corporativa:** autenticação direta com e-mail e senha cadastrados no Supabase Auth.
- **Link mágico:** o usuário recebe um link temporário no e-mail e retorna autenticado ao portal.

Não existe cadastro público pela tela. Nas duas opções, o usuário precisa estar criado em **Authentication > Users** e possuir um perfil válido em `public.app_users`.

## Domínios permitidos

O portal aceita somente estes domínios:

- `@claro.com.br`
- `@eqsengenharia.com.br`

A validação no frontend orienta o usuário. A autorização real permanece no Supabase, por meio do perfil, das políticas RLS, das funções e das regras de Storage.

O link mágico usa `shouldCreateUser: true`: um e-mail de domínio autorizado
recebe o link, confirma a posse da caixa de entrada e a conta é criada
automaticamente. O gatilho de `auth.users` recusa qualquer domínio fora da
lista, então o auto-cadastro continua restrito aos domínios corporativos.

## Papéis de acesso

O papel é atribuído automaticamente pelo domínio do e-mail:

- `@eqsengenharia.com.br` → `operacao_eqs` (acesso total: casos, sites, colaboradores e documentos)
- `@claro.com.br` → `cliente_claro` (consulta autorizada, sem ações operacionais)

O papel `operacao_eqs` permite alterar casos, sites, colaboradores e
documentos. A atribuição automática por domínio é a política atual do portal;
ajustes pontuais continuam possíveis via SQL no Supabase.

## Criar senha após o primeiro acesso

O primeiro acesso é feito pelo link mágico, que comprova a posse do e-mail.
Depois de entrar, o portal oferece a etapa **Defina sua senha**:

1. O usuário informa a nova senha e a confirmação.
2. O frontend valida a política: mínimo de 8 caracteres, com letras e números.
3. A senha é gravada na identidade Auth com `supabase.auth.updateUser`.
4. Nas próximas entradas, o usuário pode usar **Login + Senha** diretamente.

O lembrete aparece uma vez por sessão e pode ser dispensado; a opção
**Definir senha** permanece disponível na barra lateral enquanto o usuário não
definir uma senha. O portal consulta a existência de senha pela função
`public.current_user_has_password()`, que lê `auth.users` com `security definer`
e devolve apenas um booleano ao frontend.

Para reforçar a política no servidor, mantenha o tamanho mínimo de senha em 8
caracteres em **Authentication > Providers > Email** do projeto hospedado.

## Configuração no Supabase hospedado

Algumas opções pertencem ao projeto hospedado e não são aplicadas apenas pelas migrations.

1. Em **Authentication > Providers**, mantenha **Email** ativo.
2. Desabilite cadastros públicos.
3. Em **Authentication > URL Configuration**, configure:

   - Site URL: `https://claudiusnoc.github.io/Dashboardacesso/`
   - Redirect URL: `https://claudiusnoc.github.io/Dashboardacesso/casos`
   - Desenvolvimento: `http://127.0.0.1:5177` e `http://localhost:5177`

4. Em **Authentication > Email Templates > Magic Link**, use `{{ .ConfirmationURL }}` no botão ou link. Exemplo:

   ```html
   <div style="font-family:Arial,sans-serif;color:#172238;max-width:520px">
     <p
       style="margin:0 0 10px;color:#5a6e90;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase"
     >
       Portal de Acessos · Claro MG
     </p>
     <h2 style="margin:0 0 16px">Seu acesso ao portal</h2>
     <p>Use o botão abaixo para confirmar sua identidade e entrar:</p>
     <p style="margin:24px 0">
       <a
         href="{{ .ConfirmationURL }}"
         style="display:inline-block;padding:13px 20px;border-radius:10px;background:#172238;color:#fff;text-decoration:none;font-weight:700"
       >
         Acessar o portal
       </a>
     </p>
     <p style="color:#596579">
       O link é temporário e só deve ser usado por você.
     </p>
     <p style="color:#596579">
       Se não solicitou este acesso, ignore a mensagem.
     </p>
   </div>
   ```

5. Configure um SMTP corporativo em **Authentication > SMTP** antes do uso em produção. O serviço padrão do Supabase é adequado apenas para testes limitados.
6. Ajuste limites de envio e considere CAPTCHA conforme o volume e a exposição do portal.

## Teste de validação

1. Confirme que todas as migrations foram aplicadas, inclusive `202607170015_magic_otp_access.sql`.
2. Crie ou confirme um usuário de um domínio permitido.
3. Verifique que existe um registro correspondente em `public.app_users`.
4. Teste a entrada com senha em `/login`.
5. Teste **Enviar link de acesso** e confirme o retorno para `/Dashboardacesso/casos` em produção.
6. Teste um e-mail não autorizado e um usuário permitido sem perfil; ambos devem ser recusados.

## Recuperação de acesso

Se a senha não funcionar, o link mágico continua permitindo a entrada sem redefinir a senha. A redefinição de senha deve ser feita pelo fluxo administrativo do Supabase ou por um fluxo de recuperação específico, caso ele seja adicionado ao portal no futuro.
