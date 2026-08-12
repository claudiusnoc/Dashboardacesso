-- Clientes Claro podem consultar todos os documentos do acesso, como a EQS.
-- As politicas de insert/update/delete continuam exclusivas da operacao EQS.

drop policy if exists authenticated_reads_visible_documents on public.case_documents;
create policy authenticated_reads_access_documents
on public.case_documents for select to authenticated
using (coalesce(public.current_app_role(), '') in ('operacao_eqs', 'cliente_claro'));

drop policy if exists authenticated_reads_visible_attachments on public.attachments;
create policy authenticated_reads_access_attachments
on public.attachments for select to authenticated
using (coalesce(public.current_app_role(), '') in ('operacao_eqs', 'cliente_claro'));

drop policy if exists authenticated_reads_allowed_case_documents on storage.objects;
create policy authenticated_reads_allowed_case_documents
on storage.objects for select to authenticated
using (
  bucket_id = 'case-documents'
  and exists (
    select 1
    from public.attachments a
    where a.storage_path = name
      and coalesce(public.current_app_role(), '') in ('operacao_eqs', 'cliente_claro')
  )
);

-- Registros antigos de checklist de colaborador tambem entram na mesma leitura.
update public.case_documents
set is_client_visible = true
where document_scope = 'collaborator';

drop function if exists public.get_case_collaborators_safe(uuid);

create or replace function public.get_case_collaborators_safe(p_case_id uuid)
returns table (
  id uuid,
  full_name text,
  cpf_masked text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or coalesce(public.current_app_role(), '') not in ('operacao_eqs', 'cliente_claro') then
    raise exception 'Usuario nao autorizado a consultar colaboradores';
  end if;

  if not exists (select 1 from public.access_cases where id = p_case_id) then
    raise exception 'Caso de acesso nao encontrado';
  end if;

  return query
  select
    c.id,
    coalesce(nullif(trim(c.full_name), ''), 'Nome nao informado')::text,
    '***.***.***-**'::text
  from public.case_collaborators cc
  join public.collaborators c on c.id = cc.collaborator_id
  where cc.case_id = p_case_id
  order by c.full_name;
end;
$$;

revoke all on function public.get_case_collaborators_safe(uuid) from public;
grant execute on function public.get_case_collaborators_safe(uuid) to authenticated;
