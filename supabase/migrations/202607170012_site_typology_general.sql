-- Shared, read-only typology intelligence. The underlying sites table remains
-- protected by its existing RLS policies; these functions expose only the
-- aggregate fields that are appropriate for both portal roles.

create or replace function public.normalize_site_type(p_station_type text)
returns text
language sql
immutable
set search_path = public
as $$
  with normalized as (
    select upper(regexp_replace(trim(coalesce(p_station_type, '')), '\s+', ' ', 'g')) as value
  )
  select case
    when value = '' or value in ('NAO INFORMADA', 'NÃO INFORMADA') then 'Não informada'
    when value ~ '[/+]' or value in ('HÍBRIDA', 'HIBRIDA') then 'Híbrida'
    when value = 'GREENFIELD' then 'Greenfield'
    when value = 'ROOFTOP' then 'Rooftop'
    when value = 'INDOOR' then 'Indoor'
    when value in ('POLESITE', 'POLE SITE') then 'Pole Site'
    when value in ('COWSITE', 'COW SITE') then 'Cow Site'
    when value in ('STREETLEVEL', 'STREET LEVEL') then 'Street Level'
    when value in ('UNDERGROUND', 'UNDERGROUND SITE') then 'Underground'
    when value in ('CENTRAL', 'SALA', 'CENTRAL/SALA') then 'Central/Sala'
    else 'Outras'
  end
  from normalized;
$$;

create or replace function public.get_site_typology_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  overview jsonb;
begin
  if auth.uid() is null
    or public.current_app_role() not in ('operacao_eqs', 'cliente_claro') then
    raise exception 'Usuário não autorizado a consultar a tipologia geral';
  end if;

  with normalized_sites as (
    select
      s.id,
      public.normalize_site_type(s.station_type) as type_label,
      coalesce(nullif(trim(s.municipality), ''), 'Não informado') as municipality_label,
      exists (
        select 1
        from public.case_sites cs
        where cs.site_id = s.id
      ) as has_case,
      s.station_type is not null and trim(s.station_type) <> '' as has_original_type,
      s.latitude is not null
        and s.longitude is not null
        and s.latitude between -90 and 90
        and s.longitude between -180 and 180 as has_valid_coordinates
    from public.sites s
  ),
  totals as (
    select
      count(*)::integer as total_sites,
      count(*) filter (where type_label <> 'Não informada')::integer as typed_sites,
      count(*) filter (where type_label = 'Não informada')::integer as untyped_sites,
      count(*) filter (where has_case)::integer as sites_with_cases,
      count(*) filter (where not has_case)::integer as sites_without_cases,
      count(*) filter (where not has_valid_coordinates)::integer as coordinate_issues,
      count(distinct municipality_label)::integer as municipality_count
    from normalized_sites
  ),
  type_counts as (
    select type_label as label, count(*)::integer as value
    from normalized_sites
    group by type_label
  ),
  municipality_counts as (
    select municipality_label as label, count(*)::integer as value
    from normalized_sites
    group by municipality_label
  )
  select jsonb_build_object(
    'total_sites', totals.total_sites,
    'typed_sites', totals.typed_sites,
    'untyped_sites', totals.untyped_sites,
    'sites_with_cases', totals.sites_with_cases,
    'sites_without_cases', totals.sites_without_cases,
    'coordinate_issues', totals.coordinate_issues,
    'municipality_count', totals.municipality_count,
    'station_types', coalesce(
      (
        select jsonb_agg(
          to_jsonb(type_counts)
          order by
            case label
              when 'Greenfield' then 1
              when 'Rooftop' then 2
              when 'Indoor' then 3
              when 'Pole Site' then 4
              when 'Cow Site' then 5
              when 'Street Level' then 6
              when 'Underground' then 7
              when 'Central/Sala' then 8
              when 'Híbrida' then 9
              when 'Outras' then 10
              when 'Não informada' then 11
              else 12
            end
        )
        from type_counts
      ),
      '[]'::jsonb
    ),
    'municipalities', coalesce(
      (
        select jsonb_agg(to_jsonb(municipality_counts) order by value desc, label)
        from municipality_counts
      ),
      '[]'::jsonb
    ),
    'generated_at', now()
  ) into overview
  from totals;

  return overview;
end;
$$;

revoke all on function public.get_site_typology_overview() from public;
grant execute on function public.get_site_typology_overview() to authenticated;

create or replace function public.search_sites_for_typology(
  p_search text default '',
  p_type text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  station text,
  municipality text,
  station_type text,
  holder text,
  eqs_cluster text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.id,
    s.station,
    s.municipality,
    s.station_type,
    s.holder,
    s.eqs_cluster
  from public.sites s
  where public.current_app_role() = 'operacao_eqs'
    and (
      length(trim(coalesce(p_search, ''))) >= 2
      or nullif(trim(coalesce(p_type, '')), '') is not null
    )
    and (
      length(trim(coalesce(p_search, ''))) < 2
      or s.station ilike '%' || trim(p_search) || '%'
      or s.smart_plan_name ilike '%' || trim(p_search) || '%'
      or s.full_station ilike '%' || trim(p_search) || '%'
    )
    and (
      nullif(trim(coalesce(p_type, '')), '') is null
      or public.normalize_site_type(s.station_type) = trim(p_type)
    )
  order by
    case when upper(s.station) = upper(trim(coalesce(p_search, ''))) then 0
         when upper(s.station) like upper(trim(coalesce(p_search, ''))) || '%' then 1
         else 2 end,
    s.station
  limit least(greatest(coalesce(p_limit, 20), 1), 20)
$$;

revoke all on function public.search_sites_for_typology(text, text, integer) from public;
grant execute on function public.search_sites_for_typology(text, text, integer) to authenticated;
