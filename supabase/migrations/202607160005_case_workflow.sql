alter table public.access_cases
add column workflow_stage text;

update public.access_cases
set workflow_stage = case
  when status = 'LIBERADO' then 'access_released'
  when lower(coalesce(stage, '')) like '%enviado%'
    or lower(coalesce(stage, '')) like '%valid%'
    or lower(coalesce(stage, '')) like '%aguardando retorno%'
    then 'holder_validation'
  when lower(coalesce(stage, '')) like '%document%'
    or lower(coalesce(stage, '')) like '%regulariza%'
    then 'documents_preparation'
  else 'blockage_identified'
end;

update public.access_cases
set status = case workflow_stage
  when 'documents_preparation' then 'LEVANTAMENTO DE DOCUMENTOS'
  when 'holder_validation' then 'EM TRATATIVA'
  when 'new_access_attempt' then 'EM TRATATIVA'
  when 'access_released' then 'LIBERADO'
  else 'PENDENTE'
end
where status <> 'CANCELADO';

alter table public.access_cases
alter column workflow_stage set not null;

alter table public.access_cases
add constraint access_cases_workflow_stage_check
check (workflow_stage in (
  'blockage_identified',
  'documents_preparation',
  'holder_validation',
  'new_access_attempt',
  'access_released'
));

create index access_cases_workflow_stage_idx
on public.access_cases (workflow_stage);

create or replace function public.workflow_stage_label(stage_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select case stage_key
    when 'blockage_identified' then 'Bloqueio identificado'
    when 'documents_preparation' then 'Documentacao em preparacao'
    when 'holder_validation' then 'Validacao pela detentora'
    when 'new_access_attempt' then 'Nova tentativa de acesso'
    when 'access_released' then 'Acesso liberado'
    else 'Etapa nao informada'
  end
$$;

create or replace function public.set_case_workflow_stage(
  p_case_id uuid,
  p_workflow_stage text
)
returns table (
  id uuid,
  workflow_stage text,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_stage text;
  next_status text;
begin
  if public.current_app_role() <> 'operacao_eqs' then
    raise exception 'Apenas a operacao EQS pode alterar a etapa do caso';
  end if;

  if p_workflow_stage not in (
    'blockage_identified',
    'documents_preparation',
    'holder_validation',
    'new_access_attempt',
    'access_released'
  ) then
    raise exception 'Etapa operacional invalida';
  end if;

  select ac.workflow_stage
  into previous_stage
  from public.access_cases ac
  where ac.id = p_case_id
  for update;

  if not found then
    raise exception 'Caso de acesso nao encontrado';
  end if;

  next_status := case p_workflow_stage
    when 'documents_preparation' then 'LEVANTAMENTO DE DOCUMENTOS'
    when 'holder_validation' then 'EM TRATATIVA'
    when 'new_access_attempt' then 'EM TRATATIVA'
    when 'access_released' then 'LIBERADO'
    else 'PENDENTE'
  end;

  return query
  update public.access_cases ac
  set workflow_stage = p_workflow_stage,
      status = next_status,
      updated_by = public.current_app_user_id()
  where ac.id = p_case_id
  returning ac.id, ac.workflow_stage, ac.status, ac.updated_at;

  if previous_stage is distinct from p_workflow_stage then
    insert into public.case_events (
      case_id,
      actor_id,
      event_type,
      description,
      is_client_visible
    ) values (
      p_case_id,
      public.current_app_user_id(),
      'Etapa atualizada',
      format(
        'Etapa alterada de %s para %s.',
        public.workflow_stage_label(previous_stage),
        public.workflow_stage_label(p_workflow_stage)
      ),
      true
    );
  end if;
end;
$$;

revoke all on function public.set_case_workflow_stage(uuid, text) from public;
grant execute on function public.set_case_workflow_stage(uuid, text) to authenticated;

create or replace function public.create_access_case(p_site_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_case_id uuid;
  selected_station text;
begin
  if public.current_app_role() <> 'operacao_eqs' then
    raise exception 'Apenas a operacao EQS pode criar casos';
  end if;

  select station into selected_station from public.sites where id = p_site_id;
  if selected_station is null then
    raise exception 'Site nao encontrado';
  end if;

  insert into public.access_cases (
    display_name,
    status,
    stage,
    workflow_stage,
    current_responsibility,
    next_action,
    created_by,
    updated_by
  ) values (
    selected_station,
    'PENDENTE',
    'Cadastro do site concluido',
    'blockage_identified',
    'EQS',
    'Identificar o bloqueio e registrar a documentacao necessaria.',
    public.current_app_user_id(),
    public.current_app_user_id()
  ) returning id into new_case_id;

  insert into public.case_sites (case_id, site_id, position)
  values (new_case_id, p_site_id, 1);

  insert into public.case_events (
    case_id,
    actor_id,
    event_type,
    description,
    is_client_visible
  ) values (
    new_case_id,
    public.current_app_user_id(),
    'Caso criado',
    'Caso iniciado na etapa Bloqueio identificado.',
    true
  );

  return new_case_id;
end;
$$;
