alter table public.collaborators
  add column cpf text,
  add column city text,
  add column next_aso_date date,
  add column source_file text,
  add column source_row integer;

alter table public.collaborators
  add constraint collaborators_cpf_format_check
  check (cpf is null or cpf ~ '^[0-9]{11}$'),
  add constraint collaborators_cpf_key unique (cpf);

alter table public.document_requirements
  add column category text not null default 'Outros',
  add column is_system boolean not null default false,
  add column created_by uuid references public.app_users(id);

alter table public.case_documents
  add column collaborator_id uuid references public.collaborators(id) on delete restrict;

alter table public.case_documents
  alter column is_client_visible set default false;

create unique index case_documents_collaborator_requirement_idx
on public.case_documents (case_id, collaborator_id, requirement_id)
where collaborator_id is not null and requirement_id is not null;

create index collaborators_cpf_idx on public.collaborators (cpf);
create index collaborators_aso_idx on public.collaborators (next_aso_date);
create index case_collaborators_collaborator_idx on public.case_collaborators (collaborator_id, case_id);

create or replace function public.ensure_document_collaborator_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.collaborator_id is not null and not exists (
    select 1 from public.case_collaborators cc
    where cc.case_id = new.case_id and cc.collaborator_id = new.collaborator_id
  ) then
    raise exception 'O colaborador precisa estar vinculado ao caso antes de receber documentos';
  end if;
  return new;
end;
$$;

create trigger ensure_document_collaborator_link
before insert or update of case_id, collaborator_id on public.case_documents
for each row execute function public.ensure_document_collaborator_link();

create or replace function public.search_collaborators(search_term text, result_limit integer default 10)
returns table (
  id uuid,
  full_name text,
  cpf text,
  city text,
  next_aso_date date
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.full_name, c.cpf, c.city, c.next_aso_date
  from public.collaborators c
  where public.current_app_role() = 'operacao_eqs'
    and c.active
    and length(trim(search_term)) >= 2
    and (
      c.full_name ilike '%' || trim(search_term) || '%'
      or (
        regexp_replace(search_term, '[^0-9]', '', 'g') <> ''
        and c.cpf like '%' || regexp_replace(search_term, '[^0-9]', '', 'g') || '%'
      )
    )
  order by
    case when upper(c.full_name) = upper(trim(search_term)) then 0
         when upper(c.full_name) like upper(trim(search_term)) || '%' then 1
         else 2 end,
    c.full_name
  limit least(greatest(result_limit, 1), 20)
$$;

grant execute on function public.search_collaborators(text, integer) to authenticated;

create trigger audit_document_requirements
after insert or update or delete on public.document_requirements
for each row execute function public.write_audit_log();

insert into public.document_requirements (name, description, category, required, active, is_system)
values
  ('ASO', 'Atestado de Saúde Ocupacional', 'Documentos Pessoais', false, true, true),
  ('RG', 'Registro Geral', 'Documentos Pessoais', false, true, true),
  ('CPF', 'Cadastro de Pessoa Física', 'Documentos Pessoais', false, true, true),
  ('CNH Digital', 'Carteira Nacional de Habilitação', 'Documentos Pessoais', false, true, true),
  ('CTPS', 'Carteira de Trabalho e Previdência Social', 'Documentos Pessoais', false, true, true),
  ('Foto 3x4', null, 'Documentos Pessoais', false, true, true),
  ('Vínculo Empregatício', null, 'Documentos Pessoais', false, true, true),
  ('Ficha de Registro', null, 'Documentos Pessoais', false, true, true),
  ('Ficha de EPI', 'Ficha de Entrega de Equipamentos de Proteção Individual', 'Documentos Pessoais', false, true, true),
  ('OS', 'Ordem de Serviço de Segurança do Trabalho', 'Documentos Pessoais', false, true, true),
  ('NR1', 'Disposições Gerais e Gerenciamento de Riscos Ocupacionais (GRO/PGR)', 'Cursos e Treinamentos (NRs)', false, true, true),
  ('NR6', 'Equipamentos de Proteção Individual (EPI)', 'Cursos e Treinamentos (NRs)', false, true, true),
  ('NR10', 'Segurança em Instalações e Serviços em Eletricidade', 'Cursos e Treinamentos (NRs)', false, true, true),
  ('NR11', 'Transporte, Movimentação, Armazenagem e Manuseio de Materiais', 'Cursos e Treinamentos (NRs)', false, true, true),
  ('NR12', 'Segurança no Trabalho em Máquinas e Equipamentos', 'Cursos e Treinamentos (NRs)', false, true, true),
  ('NR18', 'Condições e Meio Ambiente de Trabalho na Indústria da Construção', 'Cursos e Treinamentos (NRs)', false, true, true),
  ('NR33', 'Segurança e Saúde nos Trabalhos em Espaços Confinados', 'Cursos e Treinamentos (NRs)', false, true, true),
  ('NR35', 'Trabalho em Altura', 'Cursos e Treinamentos (NRs)', false, true, true)
on conflict (name) do update set
  description = excluded.description,
  category = excluded.category,
  active = true,
  is_system = true;
