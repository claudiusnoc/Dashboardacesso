drop function public.get_sites_map_catalog();

create function public.get_sites_map_catalog()
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', map_site.id,
        'station', map_site.station,
        'full_station', map_site.full_station,
        'smart_plan_name', map_site.smart_plan_name,
        'address', map_site.address,
        'municipality', map_site.municipality,
        'postal_code', map_site.postal_code,
        'latitude', map_site.latitude,
        'longitude', map_site.longitude,
        'station_type', map_site.station_type,
        'station_type_normalized', map_site.station_type_normalized,
        'holder', map_site.holder,
        'eqs_cluster', map_site.eqs_cluster,
        'priority_level', map_site.priority_level,
        'case_count', map_site.case_count
      )
      order by map_site.station
    ),
    '[]'::jsonb
  ) into result
  from (
    select
      s.id,
      s.station,
      s.full_station,
      s.smart_plan_name,
      s.address,
      s.municipality,
      s.postal_code,
      s.latitude::double precision as latitude,
      s.longitude::double precision as longitude,
      s.station_type,
      public.normalize_site_type(s.station_type) as station_type_normalized,
      s.holder,
      s.eqs_cluster,
      s.priority_level,
      (
        select count(*)::integer
        from public.case_sites cs
        where cs.site_id = s.id
      ) as case_count
    from public.sites s
    where s.latitude is not null
      and s.longitude is not null
      and s.latitude between -90 and 90
      and s.longitude between -180 and 180
  ) map_site;

  return result;
end;
$$;

revoke all on function public.get_sites_map_catalog() from public;
grant execute on function public.get_sites_map_catalog() to authenticated;
