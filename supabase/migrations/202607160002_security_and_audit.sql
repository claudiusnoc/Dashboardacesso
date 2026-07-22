create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_users where auth_user_id = auth.uid()
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.app_users where auth_user_id = auth.uid()
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_users_updated_at before update on public.app_users
for each row execute function public.set_updated_at();
create trigger sites_updated_at before update on public.sites
for each row execute function public.set_updated_at();
create trigger access_cases_updated_at before update on public.access_cases
for each row execute function public.set_updated_at();
create trigger collaborators_updated_at before update on public.collaborators
for each row execute function public.set_updated_at();
create trigger document_requirements_updated_at before update on public.document_requirements
for each row execute function public.set_updated_at();
create trigger case_documents_updated_at before update on public.case_documents
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (auth_user_id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    'cliente_claro'
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id text;
begin
  row_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'case_id', to_jsonb(old) ->> 'case_id');
  insert into public.audit_log (actor_auth_user_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    row_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_sites after insert or update or delete on public.sites
for each row execute function public.write_audit_log();
create trigger audit_access_cases after insert or update or delete on public.access_cases
for each row execute function public.write_audit_log();
create trigger audit_case_sites after insert or update or delete on public.case_sites
for each row execute function public.write_audit_log();
create trigger audit_collaborators after insert or update or delete on public.collaborators
for each row execute function public.write_audit_log();
create trigger audit_case_collaborators after insert or update or delete on public.case_collaborators
for each row execute function public.write_audit_log();
create trigger audit_case_documents after insert or update or delete on public.case_documents
for each row execute function public.write_audit_log();
create trigger audit_attachments after insert or update or delete on public.attachments
for each row execute function public.write_audit_log();

alter table public.app_users enable row level security;
alter table public.sites enable row level security;
alter table public.access_cases enable row level security;
alter table public.case_sites enable row level security;
alter table public.collaborators enable row level security;
alter table public.case_collaborators enable row level security;
alter table public.case_events enable row level security;
alter table public.document_requirements enable row level security;
alter table public.case_documents enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_log enable row level security;

create policy app_users_read_self_or_operation on public.app_users for select
using (auth_user_id = auth.uid() or public.current_app_role() = 'operacao_eqs');

create policy operation_reads_catalog on public.sites for select
using (public.current_app_role() = 'operacao_eqs');
create policy client_reads_sites_linked_to_cases on public.sites for select
using (
  public.current_app_role() = 'cliente_claro'
  and exists (
    select 1 from public.case_sites cs
    where cs.site_id = sites.id
  )
);
create policy operation_manages_catalog on public.sites for all
using (public.current_app_role() = 'operacao_eqs')
with check (public.current_app_role() = 'operacao_eqs');

create policy authenticated_reads_cases on public.access_cases for select
using (auth.uid() is not null);
create policy operation_manages_cases on public.access_cases for all
using (public.current_app_role() = 'operacao_eqs')
with check (public.current_app_role() = 'operacao_eqs');

create policy authenticated_reads_case_sites on public.case_sites for select
using (auth.uid() is not null);
create policy operation_manages_case_sites on public.case_sites for all
using (public.current_app_role() = 'operacao_eqs')
with check (public.current_app_role() = 'operacao_eqs');

create policy operation_manages_collaborators on public.collaborators for all
using (public.current_app_role() = 'operacao_eqs')
with check (public.current_app_role() = 'operacao_eqs');
create policy operation_manages_case_collaborators on public.case_collaborators for all
using (public.current_app_role() = 'operacao_eqs')
with check (public.current_app_role() = 'operacao_eqs');

create policy authenticated_reads_visible_events on public.case_events for select
using (public.current_app_role() = 'operacao_eqs' or is_client_visible);
create policy operation_manages_events on public.case_events for all
using (public.current_app_role() = 'operacao_eqs')
with check (public.current_app_role() = 'operacao_eqs');

create policy authenticated_reads_requirements on public.document_requirements for select
using (auth.uid() is not null);
create policy operation_manages_requirements on public.document_requirements for all
using (public.current_app_role() = 'operacao_eqs')
with check (public.current_app_role() = 'operacao_eqs');

create policy authenticated_reads_visible_documents on public.case_documents for select
using (public.current_app_role() = 'operacao_eqs' or is_client_visible);
create policy operation_manages_documents on public.case_documents for all
using (public.current_app_role() = 'operacao_eqs')
with check (public.current_app_role() = 'operacao_eqs');

create policy authenticated_reads_visible_attachments on public.attachments for select
using (public.current_app_role() = 'operacao_eqs' or is_client_visible);
create policy operation_manages_attachments on public.attachments for all
using (public.current_app_role() = 'operacao_eqs')
with check (public.current_app_role() = 'operacao_eqs');

create policy operation_reads_audit on public.audit_log for select
using (public.current_app_role() = 'operacao_eqs');

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
