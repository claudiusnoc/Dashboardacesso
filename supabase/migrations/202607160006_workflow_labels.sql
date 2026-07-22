create or replace function public.workflow_stage_label(stage_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select case stage_key
    when 'blockage_identified' then 'Bloqueio identificado'
    when 'documents_preparation' then 'Documentação em preparação'
    when 'holder_validation' then 'Validação pela detentora'
    when 'new_access_attempt' then 'Nova tentativa de acesso'
    when 'access_released' then 'Acesso liberado'
    else 'Etapa não informada'
  end
$$;
