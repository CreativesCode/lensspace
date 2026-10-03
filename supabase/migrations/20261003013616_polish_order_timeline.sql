-- QA-48: one timeline row per incident (the job's 'incident' status event duplicated
-- it) carrying the cost owner, and readable reasons for unsent WhatsApp attempts.
do $$
declare
  definition text := pg_get_functiondef('public.get_order_timeline(bigint)'::regprocedure);
  patched text;
begin
  patched := replace(definition,
    $old$    where job.order_id = sale_order.id
    union all
    select 'incident:' || incident.id, 'incident', 'Incidencia de producción',
      incident.description, incident.opened_by, incident.opened_at,$old$,
    $new$    where job.order_id = sale_order.id
      and production_event.to_status <> 'incident'
    union all
    select 'incident:' || incident.id, 'incident', 'Incidencia de producción',
      incident.description || ' · Costo: ' || case incident.cost_responsibility
        when 'organization' then 'Óptica'
        when 'lens_provider' then 'Cristalero'
        when 'mounting_provider' then 'Montador'
        when 'customer' then 'Cliente'
        else incident.cost_responsibility
      end,
      incident.opened_by, incident.opened_at,$new$);
  patched := replace(patched,
    $old$when 'failed' then case when attempt.failure_code = 'provider_unconfirmed' then 'WhatsApp enviado sin confirmación del proveedor' else 'Intento de WhatsApp fallido' end$old$,
    $new$when 'failed' then case attempt.failure_code
          when 'provider_unconfirmed' then 'WhatsApp enviado sin confirmación del proveedor'
          when 'missing_consent' then 'WhatsApp no enviado: el cliente no autorizó mensajes'
          when 'module_unavailable' then 'WhatsApp no enviado: el módulo no está activo'
          else 'Intento de WhatsApp fallido'
        end$new$);
  if patched = definition or position('missing_consent' in patched) = 0 or position('<> ''incident''' in patched) = 0 then
    raise exception 'get_order_timeline did not contain the expected fragments';
  end if;
  execute patched;
end;
$$;
