-- Reaproveita a lista de documentos de um colaborador já vinculado ao caso.
-- O novo checklist sempre começa sem andamento, prazo, observação ou anexos.
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
    raise exception 'Apenas a operação EQS pode copiar checklists de colaboradores';
  end if;

  if p_source_collaborator_id = p_target_collaborator_id then
    raise exception 'Escolha colaboradores diferentes para copiar o checklist';
  end if;

  if not exists (
    select 1
    from public.case_collaborators
    where case_id = p_case_id
      and collaborator_id = p_source_collaborator_id
  ) or not exists (
    select 1
    from public.case_collaborators
    where case_id = p_case_id
      and collaborator_id = p_target_collaborator_id
  ) then
    raise exception 'Os dois colaboradores precisam estar vinculados ao caso';
  end if;

  insert into public.case_documents (
    case_id,
    collaborator_id,
    requirement_id,
    name,
    status,
    owner,
    due_date,
    evidence_note,
    is_client_visible,
    updated_by,
    document_scope
  )
  select
    source.case_id,
    p_target_collaborator_id,
    source.requirement_id,
    source.name,
    'pendente',
    null,
    null,
    null,
    false,
    public.current_app_user_id(),
    'collaborator'
  from public.case_documents source
  where source.case_id = p_case_id
    and source.collaborator_id = p_source_collaborator_id
    and source.document_scope = 'collaborator'
    and not exists (
      select 1
      from public.case_documents target
      where target.case_id = p_case_id
        and target.collaborator_id = p_target_collaborator_id
        and target.document_scope = 'collaborator'
        and (
          (source.requirement_id is not null and target.requirement_id = source.requirement_id)
          or (
            source.requirement_id is null
            and target.requirement_id is null
            and lower(trim(target.name)) = lower(trim(source.name))
          )
        )
    )
  on conflict (case_id, collaborator_id, requirement_id)
    where collaborator_id is not null and requirement_id is not null
    do nothing;

  get diagnostics copied_count = row_count;
  return copied_count;
end;
$$;

revoke all on function public.copy_collaborator_document_checklist(uuid, uuid, uuid) from public;
grant execute on function public.copy_collaborator_document_checklist(uuid, uuid, uuid) to authenticated;
