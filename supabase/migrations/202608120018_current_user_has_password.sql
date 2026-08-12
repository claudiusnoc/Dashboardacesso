-- Consulta segura para saber se o usuário autenticado já definiu senha.
--
-- A leitura de auth.users é feita por função security definer, então o
-- frontend não precisa de acesso direto ao schema auth. O nullif cobre tanto
-- senha vazia (usuário criado só por link mágico) quanto NULL.

create or replace function public.current_user_has_password()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select nullif(u.encrypted_password, '') is not null
    from auth.users u
    where u.id = auth.uid()
  ), false)
$$;

revoke all on function public.current_user_has_password() from public;
grant execute on function public.current_user_has_password() to authenticated;
