-- In PL/pgSQL, columns declared by RETURNS TABLE become variables in scope.
-- Qualifying access_cases.id prevents the client RPCs from treating `id` as
-- ambiguous before they can load collaborators or their documents.
create or replace function public.get_case_collaborators_safe(p_case_id uuid)
returns table (
  id uuid,
  full_name text,
  cpf_masked text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or coalesce(public.current_app_role(), '') not in ('operacao_eqs', 'cliente_claro') then
    raise exception 'Usuario nao autorizado a consultar colaboradores';
  end if;

  if not exists (
    select 1
    from public.access_cases ac
    where ac.id = p_case_id
  ) then
    raise exception 'Caso de acesso nao encontrado';
  end if;

  return query
  select
    c.id,
    coalesce(nullif(trim(c.full_name), ''), 'Nome nao informado')::text,
    '***.***.***-**'::text
  from public.case_collaborators cc
  join public.collaborators c on c.id = cc.collaborator_id
  where cc.case_id = p_case_id
  order by c.full_name;
end;
$$;

create or replace function public.get_case_collaborator_documents_safe(p_case_id uuid)
returns table (
  id uuid,
  collaborator_id uuid,
  collaborator_name text,
  collaborator_cpf_masked text,
  requirement_id uuid,
  name text,
  status text,
  due_date date,
  evidence_note text,
  updated_at timestamptz,
  category text,
  requirement_description text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or coalesce(public.current_app_role(), '') not in ('operacao_eqs', 'cliente_claro') then
    raise exception 'Usuario nao autorizado a consultar documentos';
  end if;

  if not exists (
    select 1
    from public.access_cases ac
    where ac.id = p_case_id
  ) then
    raise exception 'Caso de acesso nao encontrado';
  end if;

  return query
  select
    d.id,
    d.collaborator_id,
    coalesce(nullif(trim(c.full_name), ''), 'Nome nao informado')::text,
    '***.***.***-**'::text,
    d.requirement_id,
    d.name,
    d.status,
    d.due_date,
    d.evidence_note,
    d.updated_at,
    coalesce(r.category, 'Outros')::text,
    r.description
  from public.case_documents d
  join public.collaborators c on c.id = d.collaborator_id
  left join public.document_requirements r on r.id = d.requirement_id
  where d.case_id = p_case_id
    and d.document_scope = 'collaborator'
  order by c.full_name, r.category, d.name, d.id;
end;
$$;

revoke all on function public.get_case_collaborators_safe(uuid) from public;
grant execute on function public.get_case_collaborators_safe(uuid) to authenticated;
revoke all on function public.get_case_collaborator_documents_safe(uuid) from public;
grant execute on function public.get_case_collaborator_documents_safe(uuid) to authenticated;
