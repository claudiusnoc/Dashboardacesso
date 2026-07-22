create or replace function public.search_sites(search_term text, result_limit integer default 10)
returns table (
  id uuid,
  station text,
  holder text,
  eqs_cluster text,
  eqs_coordinator text,
  priority_level text,
  address text
)
language sql
stable
security invoker
set search_path = public
as $$
  select s.id, s.station, s.holder, s.eqs_cluster, s.eqs_coordinator, s.priority_level, s.address
  from public.sites s
  where public.current_app_role() = 'operacao_eqs'
    and length(trim(search_term)) >= 2
    and (s.station ilike '%' || trim(search_term) || '%' or s.smart_plan_name ilike '%' || trim(search_term) || '%')
  order by
    case when upper(s.station) = upper(trim(search_term)) then 0
         when upper(s.station) like upper(trim(search_term)) || '%' then 1
         else 2 end,
    s.station
  limit least(greatest(result_limit, 1), 20)
$$;

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
    display_name, status, stage, current_responsibility, next_action, created_by, updated_by
  ) values (
    selected_station,
    'RASCUNHO',
    'Cadastro do site concluido',
    'EQS',
    'Vincular colaboradores e definir documentacao necessaria.',
    public.current_app_user_id(),
    public.current_app_user_id()
  ) returning id into new_case_id;

  insert into public.case_sites (case_id, site_id, position)
  values (new_case_id, p_site_id, 1);

  insert into public.case_events (case_id, actor_id, event_type, description, is_client_visible)
  values (new_case_id, public.current_app_user_id(), 'Caso criado', 'Cadastro do site concluido. Caso salvo como rascunho.', true);

  return new_case_id;
end;
$$;

grant execute on function public.search_sites(text, integer) to authenticated;
grant execute on function public.create_access_case(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('case-documents', 'case-documents', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy operation_uploads_case_documents on storage.objects for insert to authenticated
with check (bucket_id = 'case-documents' and public.current_app_role() = 'operacao_eqs');

create policy operation_updates_case_documents on storage.objects for update to authenticated
using (bucket_id = 'case-documents' and public.current_app_role() = 'operacao_eqs')
with check (bucket_id = 'case-documents' and public.current_app_role() = 'operacao_eqs');

create policy operation_deletes_case_documents on storage.objects for delete to authenticated
using (bucket_id = 'case-documents' and public.current_app_role() = 'operacao_eqs');

create policy authenticated_reads_allowed_case_documents on storage.objects for select to authenticated
using (
  bucket_id = 'case-documents'
  and exists (
    select 1 from public.attachments a
    where a.storage_path = name
      and (public.current_app_role() = 'operacao_eqs' or a.is_client_visible)
  )
);
