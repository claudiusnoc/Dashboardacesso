-- Passwordless portal access is restricted to the two corporate domains below.
-- New identities are still provisioned by an administrator; the frontend uses
-- signInWithOtp(... shouldCreateUser: false), so a corporate address alone
-- never creates a portal account or grants an operational role.

create table public.allowed_portal_email_domains (
  domain text primary key,
  created_at timestamptz not null default now(),
  constraint allowed_portal_email_domains_lower_check
    check (domain = lower(btrim(domain))),
  constraint allowed_portal_email_domains_format_check
    check (domain ~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$')
);

alter table public.allowed_portal_email_domains enable row level security;

revoke all on table public.allowed_portal_email_domains from anon, authenticated;

insert into public.allowed_portal_email_domains (domain)
values
  ('claro.com.br'),
  ('eqsengenharia.com.br')
on conflict (domain) do nothing;

create or replace function public.is_portal_email_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with normalized_email as (
    select lower(btrim(coalesce(p_email, ''))) as value
  )
  select
    value ~ '^[^@[:space:]]+@[^@[:space:]]+$'
    and exists (
      select 1
      from public.allowed_portal_email_domains d
      where d.domain = split_part(value, '@', 2)
    )
  from normalized_email
$$;

-- Always return a text value. An empty role is deliberately denied by every
-- policy and RPC that checks the application role.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select au.role
    from public.app_users au
    join auth.users u on u.id = au.auth_user_id
    where au.auth_user_id = auth.uid()
      and public.is_portal_email_allowed(u.email)
  ), '')
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select au.id
  from public.app_users au
  join auth.users u on u.id = au.auth_user_id
  where au.auth_user_id = auth.uid()
    and public.is_portal_email_allowed(u.email)
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_portal_email_allowed(new.email) then
    raise exception using
      errcode = '42501',
      message = 'O domínio deste e-mail não está autorizado para o Portal de Acessos';
  end if;

  insert into public.app_users (auth_user_id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    lower(new.email),
    'cliente_claro'
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.is_portal_email_allowed(text) from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.current_app_user_id() from public;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_app_user_id() to authenticated;

-- Stop instead of silently locking a pre-existing user who does not meet the
-- agreed domain policy. The migration is transactional, so no partial change
-- is applied if the organization needs to review a legacy profile first.
do $$
declare
  invalid_profile_count integer;
begin
  select count(*)
  into invalid_profile_count
  from public.app_users au
  join auth.users u on u.id = au.auth_user_id
  where not public.is_portal_email_allowed(u.email);

  if invalid_profile_count > 0 then
    raise exception
      'Há % perfil(is) existente(s) fora de claro.com.br e eqsengenharia.com.br. Revise-os antes de ativar a restrição.',
      invalid_profile_count;
  end if;
end;
$$;

drop policy if exists app_users_read_self_or_operation on public.app_users;
create policy app_users_read_self_or_operation
on public.app_users for select to authenticated
using (
  public.current_app_role() = 'operacao_eqs'
  or (
    auth_user_id = auth.uid()
    and public.current_app_role() in ('operacao_eqs', 'cliente_claro')
  )
);

drop policy if exists authenticated_reads_cases on public.access_cases;
create policy authenticated_reads_cases
on public.access_cases for select to authenticated
using (public.current_app_role() in ('operacao_eqs', 'cliente_claro'));

drop policy if exists authenticated_reads_case_sites on public.case_sites;
create policy authenticated_reads_case_sites
on public.case_sites for select to authenticated
using (public.current_app_role() in ('operacao_eqs', 'cliente_claro'));

drop policy if exists authenticated_reads_requirements on public.document_requirements;
create policy authenticated_reads_requirements
on public.document_requirements for select to authenticated
using (public.current_app_role() in ('operacao_eqs', 'cliente_claro'));

drop policy if exists authenticated_reads_visible_events on public.case_events;
create policy authenticated_reads_visible_events
on public.case_events for select to authenticated
using (
  public.current_app_role() = 'operacao_eqs'
  or (
    public.current_app_role() = 'cliente_claro'
    and is_client_visible
  )
);

drop policy if exists authenticated_reads_visible_documents on public.case_documents;
create policy authenticated_reads_visible_documents
on public.case_documents for select to authenticated
using (
  public.current_app_role() = 'operacao_eqs'
  or (
    public.current_app_role() = 'cliente_claro'
    and is_client_visible
  )
);

drop policy if exists authenticated_reads_visible_attachments on public.attachments;
create policy authenticated_reads_visible_attachments
on public.attachments for select to authenticated
using (
  public.current_app_role() = 'operacao_eqs'
  or (
    public.current_app_role() = 'cliente_claro'
    and is_client_visible
  )
);

drop policy if exists authenticated_reads_allowed_case_documents on storage.objects;
create policy authenticated_reads_allowed_case_documents
on storage.objects for select to authenticated
using (
  bucket_id = 'case-documents'
  and exists (
    select 1
    from public.attachments a
    where a.storage_path = name
      and (
        public.current_app_role() = 'operacao_eqs'
        or (
          public.current_app_role() = 'cliente_claro'
          and a.is_client_visible
        )
      )
  )
);
