-- Treat a missing application profile as unauthorized as well.
create or replace function public.get_case_collaborators_safe(p_case_id uuid)
returns table (
  abbreviated_name text,
  cpf_masked text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or coalesce(public.current_app_role(), '') not in ('operacao_eqs', 'cliente_claro') then
    raise exception 'Usuário não autorizado a consultar colaboradores';
  end if;

  if not exists (select 1 from public.access_cases where id = p_case_id) then
    raise exception 'Caso de acesso não encontrado';
  end if;

  return query
  select
    public.abbreviate_collaborator_name(c.full_name),
    '•••.•••.•••-••'::text
  from public.case_collaborators cc
  join public.collaborators c on c.id = cc.collaborator_id
  where cc.case_id = p_case_id
  order by c.full_name;
end;
$$;
