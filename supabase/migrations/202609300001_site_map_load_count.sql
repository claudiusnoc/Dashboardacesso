-- Expõe a quantidade de estações que cada site carrega no detalhe do mapa.

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
    'loaded_station_count', s.loaded_station_count,
    'energy_technician_1', s.energy_technician_1,
    'energy_technician_2', s.energy_technician_2,
    'energy_technician_3', s.energy_technician_3,
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

revoke all on function public.get_site_map_detail(uuid) from public;
grant execute on function public.get_site_map_detail(uuid) to authenticated;
