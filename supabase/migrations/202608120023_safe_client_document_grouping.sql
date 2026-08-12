-- Consulta segura para a visao do cliente: cada documento retorna com o
-- colaborador dono do checklist, evitando agrupar documentos repetidos juntos.
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

  if not exists (select 1 from public.access_cases where id = p_case_id) then
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

revoke all on function public.get_case_collaborator_documents_safe(uuid) from public;
grant execute on function public.get_case_collaborator_documents_safe(uuid) to authenticated;

-- Novos e antigos checklists de colaborador ficam disponíveis para consulta.
update public.case_documents
set is_client_visible = true
where document_scope = 'collaborator';

create or replace function public.copy_collaborator_document_checklist(
  p_case_id uuid,
  p_source_collaborator_id uuid,
  p_target_collaborator_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  copied_count integer;
begin
  if public.current_app_role() <> 'operacao_eqs' then
    raise exception 'Apenas a operacao EQS pode copiar checklists de colaboradores';
  end if;
  if p_source_collaborator_id = p_target_collaborator_id then
    raise exception 'Escolha colaboradores diferentes para copiar o checklist';
  end if;
  if not exists (select 1 from public.case_collaborators where case_id = p_case_id and collaborator_id = p_source_collaborator_id)
    or not exists (select 1 from public.case_collaborators where case_id = p_case_id and collaborator_id = p_target_collaborator_id) then
    raise exception 'Os dois colaboradores precisam estar vinculados ao caso';
  end if;

  insert into public.case_documents (
    case_id, collaborator_id, requirement_id, name, status, owner,
    due_date, evidence_note, is_client_visible, updated_by, document_scope
  )
  select source.case_id, p_target_collaborator_id, source.requirement_id,
    source.name, 'pendente', null, null, null, true,
    public.current_app_user_id(), 'collaborator'
  from public.case_documents source
  where source.case_id = p_case_id
    and source.collaborator_id = p_source_collaborator_id
    and source.document_scope = 'collaborator'
    and not exists (
      select 1 from public.case_documents target
      where target.case_id = p_case_id
        and target.collaborator_id = p_target_collaborator_id
        and target.document_scope = 'collaborator'
        and ((source.requirement_id is not null and target.requirement_id = source.requirement_id)
          or (source.requirement_id is null and target.requirement_id is null
            and lower(trim(target.name)) = lower(trim(source.name))))
    )
  on conflict (case_id, collaborator_id, requirement_id)
    where collaborator_id is not null and requirement_id is not null do nothing;

  get diagnostics copied_count = row_count;
  return copied_count;
end;
$$;

revoke all on function public.copy_collaborator_document_checklist(uuid, uuid, uuid) from public;
grant execute on function public.copy_collaborator_document_checklist(uuid, uuid, uuid) to authenticated;
