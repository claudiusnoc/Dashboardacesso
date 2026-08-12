-- Modo teste de visualização (alternância Operador <-> Cliente).
--
-- Usuários com can_switch_role podem alternar o papel efetivo usado pelo
-- portal (RLS e interface) sem alterar o papel real. O papel de teste fica
-- gravado em app_users.test_role e só pode ser definido pela RPC
-- set_portal_test_role, que exige can_switch_role = true.

alter table public.app_users
  add column can_switch_role boolean not null default false,
  add column test_role text
    check (test_role in ('operacao_eqs', 'cliente_claro'));

create or replace function public.set_portal_test_role(p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role is not null and p_role not in ('operacao_eqs', 'cliente_claro') then
    raise exception using
      errcode = 'P0001',
      message = 'Papel de teste inválido';
  end if;

  update public.app_users
  set test_role = p_role
  where auth_user_id = auth.uid()
    and can_switch_role;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Sem permissão para alternar a visualização';
  end if;
end;
$$;

revoke all on function public.set_portal_test_role(text) from public;
grant execute on function public.set_portal_test_role(text) to authenticated;

-- O papel efetivo considera primeiro o papel de teste (quando o usuário pode
-- alternar) e depois o papel real.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select nullif(au.test_role, '')
      from public.app_users au
      join auth.users u on u.id = au.auth_user_id
      where au.auth_user_id = auth.uid()
        and public.is_portal_email_allowed(u.email)
        and au.can_switch_role
    ),
    (
      select au.role
      from public.app_users au
      join auth.users u on u.id = au.auth_user_id
      where au.auth_user_id = auth.uid()
        and public.is_portal_email_allowed(u.email)
    ),
    ''
  )
$$;

-- Habilita o modo teste para o operador de referência.
update public.app_users
set can_switch_role = true
where email = 'claudius.rangel@eqsengenharia.com.br';
