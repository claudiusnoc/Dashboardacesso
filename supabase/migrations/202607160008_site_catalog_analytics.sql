create or replace function public.get_site_catalog_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  analytics jsonb;
begin
  if public.current_app_role() <> 'operacao_eqs' then
    raise exception 'Apenas a operacao EQS pode consultar a base analitica de sites';
  end if;

  with normalized_sites as (
    select
      coalesce(
        nullif(upper(regexp_replace(trim(holder), '\s+', ' ', 'g')), ''),
        'NAO INFORMADO'
      ) as holder_label,
      coalesce(
        nullif(upper(regexp_replace(trim(eqs_cluster), '\s+', ' ', 'g')), ''),
        'NAO INFORMADO'
      ) as cluster_label,
      case
        when upper(trim(coalesce(station_type, ''))) like 'GREENFIELD%' then 'GREENFIELD'
        when upper(trim(coalesce(station_type, ''))) like 'ROOFTOP%' then 'ROOFTOP'
        else 'OUTRAS TIPOLOGIAS'
      end as station_type_label
    from public.sites
  ),
  holder_counts as (
    select holder_label as label, count(*)::integer as value
    from normalized_sites
    group by holder_label
  ),
  cluster_counts as (
    select cluster_label as label, count(*)::integer as value
    from normalized_sites
    group by cluster_label
  ),
  station_type_counts as (
    select station_type_label as label, count(*)::integer as value
    from normalized_sites
    group by station_type_label
  )
  select jsonb_build_object(
    'total_sites', (select count(*)::integer from normalized_sites),
    'holders', coalesce(
      (
        select jsonb_agg(to_jsonb(holder_counts) order by value desc, label)
        from holder_counts
      ),
      '[]'::jsonb
    ),
    'clusters', coalesce(
      (
        select jsonb_agg(to_jsonb(cluster_counts) order by value desc, label)
        from cluster_counts
      ),
      '[]'::jsonb
    ),
    'station_types', coalesce(
      (
        select jsonb_agg(
          to_jsonb(station_type_counts)
          order by
            case label
              when 'GREENFIELD' then 1
              when 'ROOFTOP' then 2
              else 3
            end
        )
        from station_type_counts
      ),
      '[]'::jsonb
    ),
    'generated_at', now()
  ) into analytics;

  return analytics;
end;
$$;

revoke all on function public.get_site_catalog_analytics() from public;
grant execute on function public.get_site_catalog_analytics() to authenticated;
