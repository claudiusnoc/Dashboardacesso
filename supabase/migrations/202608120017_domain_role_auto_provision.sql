-- Provisionamento automático por domínio corporativo.
--
-- A partir desta migration, um e-mail autorizado cria a própria conta ao usar
-- o link mágico (signInWithOtp com shouldCreateUser: true). O papel passa a
-- ser atribuído pelo domínio:
--   @eqsengenharia.com.br -> operacao_eqs (acesso total)
--   @claro.com.br         -> cliente_claro (consulta autorizada)
--
-- Domínios fora da lista continuam sendo recusados pelo gatilho.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.is_portal_email_allowed(new.email) then
    raise exception using
      errcode = '42501',
      message = 'O domínio deste e-mail não está autorizado para o Portal de Acessos';
  end if;

  v_role := case
    when split_part(lower(new.email), '@', 2) = 'eqsengenharia.com.br' then 'operacao_eqs'
    else 'cliente_claro'
  end;

  insert into public.app_users (auth_user_id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    lower(new.email),
    v_role
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

-- Completa perfis faltantes de usuários já existentes no Auth.
insert into public.app_users (auth_user_id, name, email, role)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)),
  lower(u.email),
  case
    when split_part(lower(u.email), '@', 2) = 'eqsengenharia.com.br' then 'operacao_eqs'
    else 'cliente_claro'
  end
from auth.users u
where public.is_portal_email_allowed(u.email)
  and not exists (
    select 1 from public.app_users au where au.auth_user_id = u.id
  )
on conflict (auth_user_id) do nothing;

-- Promove perfis EQS existentes para acesso total.
update public.app_users au
set role = 'operacao_eqs'
from auth.users u
where u.id = au.auth_user_id
  and split_part(lower(u.email), '@', 2) = 'eqsengenharia.com.br'
  and au.role <> 'operacao_eqs';
