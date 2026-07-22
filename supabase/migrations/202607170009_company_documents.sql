alter table public.access_cases
  add column company_documents_requirement text not null default 'a_definir'
    check (company_documents_requirement in ('a_definir', 'necessaria', 'nao_necessaria'));

alter table public.document_requirements
  add column document_scope text not null default 'collaborator'
    check (document_scope in ('collaborator', 'company'));

alter table public.case_documents
  add column document_scope text not null default 'collaborator'
    check (document_scope in ('collaborator', 'company'));

create unique index case_documents_company_requirement_idx
on public.case_documents (case_id, requirement_id)
where document_scope = 'company' and requirement_id is not null;

insert into public.document_requirements (
  name,
  description,
  category,
  required,
  active,
  is_system,
  document_scope
)
values
  ('PCMSO', 'Programa de Controle Médico de Saúde Ocupacional', 'Documentos Patronais', false, true, true, 'company'),
  ('PGR', 'Programa de Gerenciamento de Riscos', 'Documentos Patronais', false, true, true, 'company'),
  ('Contrato Social Consolidado', null, 'Documentos Patronais', false, true, true, 'company'),
  ('Estatuto Social', null, 'Documentos Patronais', false, true, true, 'company'),
  ('Certidão Simplificada da Junta Comercial do Estado', null, 'Documentos Patronais', false, true, true, 'company')
on conflict (name) do update set
  description = excluded.description,
  category = excluded.category,
  active = true,
  is_system = true,
  document_scope = 'company';

create or replace function public.set_company_documents_requirement(
  p_case_id uuid,
  p_requirement text
)
returns public.access_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_case public.access_cases;
begin
  if public.current_app_role() <> 'operacao_eqs' then
    raise exception 'Apenas a operação EQS pode configurar a documentação patronal';
  end if;

  if p_requirement not in ('a_definir', 'necessaria', 'nao_necessaria') then
    raise exception 'Estado de documentação patronal inválido';
  end if;

  if p_requirement = 'nao_necessaria' then
    delete from public.case_documents
    where case_id = p_case_id
      and document_scope = 'company';
  end if;

  update public.access_cases
  set company_documents_requirement = p_requirement,
      updated_by = public.current_app_user_id()
  where id = p_case_id
  returning * into updated_case;

  if updated_case.id is null then
    raise exception 'Caso de acesso não encontrado';
  end if;

  return updated_case;
end;
$$;

revoke all on function public.set_company_documents_requirement(uuid, text) from public;
grant execute on function public.set_company_documents_requirement(uuid, text) to authenticated;
