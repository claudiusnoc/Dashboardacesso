create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  role text not null default 'cliente_claro'
    check (role in ('operacao_eqs', 'cliente_claro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  id_smart_plan text,
  smart_plan_name text,
  site_origin text,
  station text not null unique,
  full_station text,
  rfp_type text,
  priority_level text,
  claro_cluster text,
  estimated_autonomy text,
  source_reference text,
  source_updated_at text,
  loaded_station_count text,
  customer_count text,
  caretaking_owner text,
  alarm_platform text,
  installation text,
  meter text,
  supplier text,
  municipality text,
  address text,
  postal_code text,
  latitude numeric(11, 7),
  longitude numeric(11, 7),
  station_type text,
  holder text,
  holder_id text,
  eqs_cluster text,
  technical_base text,
  technical_area text,
  energy_technician_1 text,
  energy_technician_2 text,
  energy_technician_3 text,
  climate_technician text,
  generator_technician text,
  eqs_supervisor text,
  eqs_coordinator text,
  claro_focal_point text,
  omr_owner text,
  bss_owner text,
  responsible_coordinator text,
  responsible_manager text,
  cost_center text,
  fixed_network_coordinator text,
  source_file text not null default 'tipologia.xlsx',
  source_row integer,
  source_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.access_cases (
  id uuid primary key default gen_random_uuid(),
  source_system text,
  source_legacy_id text,
  display_name text not null,
  status text not null default 'RASCUNHO'
    check (status in ('RASCUNHO', 'PENDENTE', 'EM TRATATIVA', 'LEVANTAMENTO DE DOCUMENTOS', 'LIBERADO', 'CANCELADO')),
  stage text,
  current_responsibility text,
  notes text,
  category text,
  next_action text,
  started_at date,
  is_legacy_group boolean not null default false,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, source_legacy_id)
);

create table public.case_sites (
  case_id uuid not null references public.access_cases(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (case_id, site_id)
);

create table public.collaborators (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  full_name text not null,
  active boolean not null default true,
  profile_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.case_collaborators (
  case_id uuid not null references public.access_cases(id) on delete cascade,
  collaborator_id uuid not null references public.collaborators(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (case_id, collaborator_id)
);

create table public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.access_cases(id) on delete cascade,
  actor_id uuid references public.app_users(id),
  event_type text not null,
  description text not null,
  is_client_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  required boolean not null default true,
  validity_days integer check (validity_days is null or validity_days >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.access_cases(id) on delete cascade,
  requirement_id uuid references public.document_requirements(id) on delete set null,
  name text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_elaboracao', 'coletado', 'enviado', 'vencido', 'aprovado')),
  owner text,
  due_date date,
  evidence_note text,
  is_client_visible boolean not null default true,
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.access_cases(id) on delete cascade,
  case_document_id uuid references public.case_documents(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  is_client_visible boolean not null default true,
  uploaded_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_auth_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index sites_station_trgm_idx on public.sites using gin (station gin_trgm_ops);
create index sites_smart_name_trgm_idx on public.sites using gin (smart_plan_name gin_trgm_ops);
create index sites_cluster_idx on public.sites (eqs_cluster);
create index access_cases_status_idx on public.access_cases (status);
create index access_cases_created_idx on public.access_cases (created_at desc);
create index case_sites_site_idx on public.case_sites (site_id, case_id);
create index case_events_timeline_idx on public.case_events (case_id, created_at desc);
create index case_documents_case_status_idx on public.case_documents (case_id, status);
create index collaborators_name_trgm_idx on public.collaborators using gin (full_name gin_trgm_ops);
create index audit_log_created_idx on public.audit_log (created_at desc);
