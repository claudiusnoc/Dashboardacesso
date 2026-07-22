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
    when value = '' then 'Não informada'
    when value ~ '[/+]' then 'Híbrida'
    when value = 'GREENFIELD' then 'Greenfield'
    when value = 'ROOFTOP' then 'Rooftop'
    when value = 'INDOOR' then 'Indoor'
    when value in ('POLESITE', 'POLE SITE') then 'Pole Site'
    when value in ('COWSITE', 'COW SITE') then 'Cow Site'
    when value in ('STREETLEVEL', 'STREET LEVEL') then 'Street Level'
    when value in ('UNDERGROUND', 'UNDERGROUND SITE') then 'Underground'
    when value in ('CENTRAL', 'SALA') then 'Central/Sala'
    else 'Outras'
  end
  from normalized;
$$;

create or replace function public.get_sites_map_catalog()
returns table (
  id uuid,
  station text,
  full_station text,
  smart_plan_name text,
  address text,
  municipality text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  station_type text,
  station_type_normalized text,
  holder text,
  eqs_cluster text,
  priority_level text,
  case_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_app_role() not in ('operacao_eqs', 'cliente_claro') then
    raise exception 'Usuário não autorizado a consultar o mapa de sites';
  end if;

  return query
  select
    s.id,
    s.station,
    s.full_station,
    s.smart_plan_name,
    s.address,
    s.municipality,
    s.postal_code,
    s.latitude::double precision,
    s.longitude::double precision,
    s.station_type,
    public.normalize_site_type(s.station_type),
    s.holder,
    s.eqs_cluster,
    s.priority_level,
    count(cs.case_id)::bigint
  from public.sites s
  left join public.case_sites cs on cs.site_id = s.id
  where s.latitude is not null
    and s.longitude is not null
    and s.latitude between -90 and 90
    and s.longitude between -180 and 180
  group by s.id
  order by s.station;
end;
$$;

create or replace function public.get_site_map_detail(p_site_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or public.current_app_role() not in ('operacao_eqs', 'cliente_claro') then
    raise exception 'Usuário não autorizado a consultar o mapa de sites';
  end if;

  select jsonb_build_object(
    'id', s.id,
    'station', s.station,
    'full_station', s.full_station,
    'smart_plan_name', s.smart_plan_name,
    'address', s.address,
    'municipality', s.municipality,
    'postal_code', s.postal_code,
    'latitude', s.latitude,
    'longitude', s.longitude,
    'station_type', s.station_type,
    'station_type_normalized', public.normalize_site_type(s.station_type),
    'holder', s.holder,
    'eqs_cluster', s.eqs_cluster,
    'priority_level', s.priority_level,
    'cases', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'display_name', c.display_name,
            'status', c.status,
            'stage', c.stage
          )
          order by c.updated_at desc
        )
        from public.case_sites cs
        join public.access_cases c on c.id = cs.case_id
        where cs.site_id = s.id
      ),
      '[]'::jsonb
    )
  ) into result
  from public.sites s
  where s.id = p_site_id;

  if result is null then
    raise exception 'Site não encontrado';
  end if;

  return result;
end;
$$;

revoke all on function public.normalize_site_type(text) from public;
revoke all on function public.get_sites_map_catalog() from public;
revoke all on function public.get_site_map_detail(uuid) from public;

grant execute on function public.normalize_site_type(text) to authenticated;
grant execute on function public.get_sites_map_catalog() to authenticated;
grant execute on function public.get_site_map_detail(uuid) to authenticated;
