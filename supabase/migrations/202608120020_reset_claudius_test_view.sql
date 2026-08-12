-- Comeca o teste sem uma visualizacao forcada: as duas opcoes aparecem no primeiro acesso.
update public.app_users
set test_role = null
where lower(email) = 'claudius.rangel@eqsengenharia.com.br'
  and can_switch_role;
