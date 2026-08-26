-- A tela de detalhe consulta a trilha por entidade para apresentar autoria e
-- comparação dos campos operacionais sem duplicar os registros de auditoria.
create index if not exists audit_log_entity_history_idx
on public.audit_log (entity_type, entity_id, created_at desc)
where action = 'UPDATE';
