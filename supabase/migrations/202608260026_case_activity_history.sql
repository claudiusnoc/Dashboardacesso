-- Exposes a sanitized, role-safe case activity feed without granting clients
-- direct access to audit_log snapshots.
create or replace function public.get_case_activity_history(
  p_case_id uuid,
  p_limit integer default 26,
  p_before_at timestamptz default null,
  p_before_key text default null
)
returns table (
  activity_key text,
  source text,
  category text,
  activity_title text,
  description_public text,
  actor_name text,
  occurred_at timestamptz,
  fields jsonb,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or coalesce(public.current_app_role(), '') not in ('operacao_eqs', 'cliente_claro') then
    raise exception 'Acesso não autorizado';
  end if;

  if not exists (select 1 from public.access_cases ac where ac.id = p_case_id) then
    raise exception 'Caso de acesso não encontrado';
  end if;

  return query
  with raw_audit as (
    select
      'audit:' || al.id::text as item_key,
      al.created_at as item_at,
      coalesce(nullif(au.name, ''), 'Usuário não identificado') as item_actor,
      (
        case when al.before_data -> 'workflow_stage' is distinct from al.after_data -> 'workflow_stage'
          then jsonb_build_array(jsonb_build_object(
            'key', 'workflow_stage',
            'label', 'Etapa atual',
            'value', coalesce(public.workflow_stage_label(al.after_data ->> 'workflow_stage'), '')
          )) else '[]'::jsonb end
        || case when al.before_data -> 'current_responsibility' is distinct from al.after_data -> 'current_responsibility'
          then jsonb_build_array(jsonb_build_object(
            'key', 'current_responsibility',
            'label', 'Responsável atual',
            'value', coalesce(al.after_data ->> 'current_responsibility', '')
          )) else '[]'::jsonb end
        || case when al.before_data -> 'next_action' is distinct from al.after_data -> 'next_action'
          then jsonb_build_array(jsonb_build_object(
            'key', 'next_action',
            'label', 'Próximo passo',
            'value', coalesce(al.after_data ->> 'next_action', '')
          )) else '[]'::jsonb end
        || case when al.before_data -> 'notes' is distinct from al.after_data -> 'notes'
          then jsonb_build_array(jsonb_build_object(
            'key', 'notes',
            'label', 'Observações',
            'value', coalesce(al.after_data ->> 'notes', '')
          )) else '[]'::jsonb end
      ) as item_fields,
      al.before_data
    from public.audit_log al
    left join public.app_users au on au.auth_user_id = al.actor_auth_user_id
    where al.entity_type = 'access_cases'
      and al.entity_id = p_case_id
      and al.action = 'UPDATE'
  ),
  audit_items as (
    select
      ra.item_key,
      'audit'::text as item_source,
      case
        when jsonb_array_length(ra.item_fields) > 1 then 'update'
        when ra.item_fields -> 0 ->> 'key' = 'workflow_stage' then 'stage'
        when ra.item_fields -> 0 ->> 'key' = 'current_responsibility' then 'responsibility'
        else 'notes'
      end as item_category,
      case
        when jsonb_array_length(ra.item_fields) > 1
          then jsonb_array_length(ra.item_fields)::text || ' informações atualizadas'
        when ra.item_fields -> 0 ->> 'key' = 'workflow_stage'
          then 'Etapa atualizada para ' || coalesce(nullif(ra.item_fields -> 0 ->> 'value', ''), 'não informada')
        when ra.item_fields -> 0 ->> 'key' = 'current_responsibility'
          then 'Responsável definido como ' || coalesce(nullif(ra.item_fields -> 0 ->> 'value', ''), 'não informado')
        when ra.item_fields -> 0 ->> 'key' = 'next_action' then 'Próximo passo atualizado'
        when coalesce(ra.before_data ->> 'notes', '') = '' then 'Observação adicionada'
        else 'Observação atualizada'
      end as item_title,
      case
        when jsonb_array_length(ra.item_fields) = 1
             and ra.item_fields -> 0 ->> 'key' in ('next_action', 'notes')
          then ra.item_fields -> 0 ->> 'value'
        when jsonb_array_length(ra.item_fields) > 1
          then (
            select string_agg(field ->> 'label', ' · ')
            from jsonb_array_elements(ra.item_fields) field
          )
        else ''
      end as item_description,
      ra.item_actor,
      ra.item_at,
      ra.item_fields
    from raw_audit ra
    where jsonb_array_length(ra.item_fields) > 0
  ),
  event_items as (
    select
      'event:' || ce.id::text as item_key,
      'event'::text as item_source,
      case when ce.event_type = 'Etapa atualizada' then 'stage' else 'event' end as item_category,
      coalesce(nullif(ce.event_type, ''), 'Atividade registrada') as item_title,
      case
        when ce.event_type = 'Etapa atualizada' then
          coalesce(
            'Etapa atualizada para ' || nullif(substring(ce.description from '(?i) para (.+?)\.?$'), ''),
            'Etapa da demanda atualizada'
          )
        else coalesce(ce.description, '')
      end as item_description,
      coalesce(nullif(eu.name, ''), 'Sistema') as item_actor,
      ce.created_at as item_at,
      '[]'::jsonb as item_fields
    from public.case_events ce
    left join public.app_users eu on eu.id = ce.actor_id
    where ce.case_id = p_case_id
      and (
        ce.event_type <> 'Etapa atualizada'
        or not exists (
          select 1
          from raw_audit ra
          where ra.item_fields @> '[{"key":"workflow_stage"}]'::jsonb
            and abs(extract(epoch from (ra.item_at - ce.created_at))) <= 5
        )
      )
  ),
  combined as (
    select * from audit_items
    union all
    select * from event_items
  )
  select
    c.item_key,
    c.item_source,
    c.item_category,
    c.item_title,
    c.item_description,
    c.item_actor,
    c.item_at,
    c.item_fields,
    count(*) over ()
  from combined c
  where p_before_at is null
     or c.item_at < p_before_at
     or (c.item_at = p_before_at and c.item_key < coalesce(p_before_key, ''))
  order by c.item_at desc, c.item_key desc
  limit least(greatest(coalesce(p_limit, 26), 1), 51);
end;
$$;

revoke all on function public.get_case_activity_history(uuid, integer, timestamptz, text) from public;
grant execute on function public.get_case_activity_history(uuid, integer, timestamptz, text) to authenticated;
