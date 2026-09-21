-- Keep production history readable for non-technical users. Internal status
-- codes remain stable; only the presentation returned by the timeline changes.
create or replace function public.get_order_timeline(target_order_id bigint)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  sale_order public.orders%rowtype;
  result jsonb;
begin
  select * into sale_order from public.orders where id = target_order_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido no encontrado o no accesible.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', event_key,
    'kind', kind,
    'title', title,
    'detail', detail,
    'actorId', actor_id,
    'actorName', coalesce(profile.display_name, 'Sistema'),
    'occurredAt', occurred_at,
    'metadata', metadata
  ) order by occurred_at, event_key), '[]'::jsonb)
  into result
  from (
    select 'order:' || sale_order.id as event_key, 'order_created' as kind,
      'Pedido confirmado' as title, sale_order.order_number as detail,
      sale_order.primary_seller_id as actor_id, sale_order.accepted_at as occurred_at,
      jsonb_build_object('status', sale_order.commercial_status) as metadata
    union all
    select 'confirmation:' || confirmation.id, 'confirmation', 'Aceptación del cliente',
      'Confirmación ' || confirmation.confirmation_method, confirmation.confirmed_by,
      confirmation.confirmed_at, jsonb_build_object('cupEquivalent', confirmation.cup_equivalent)
    from public.order_confirmations confirmation where confirmation.order_id = sale_order.id
    union all
    select 'payment:' || payment.id, 'payment', 'Pago registrado',
      payment.amount || ' ' || payment.currency, payment.received_by, payment.received_at,
      jsonb_build_object('equivalentCup', payment.equivalent_cup, 'postClose', payment.is_post_close)
    from public.payments payment where payment.order_id = sale_order.id
    union all
    select 'production:' || production_event.id, 'production',
      case production_event.to_status
        when 'pending' then case job.job_type when 'lens' then 'Asignado al cristalero' else 'Asignado al montador' end
        when 'ready_to_send' then case job.job_type when 'lens' then 'Cristales listos para entregar al cristalero' else 'Trabajo listo para entregar al montador' end
        when 'dispatched' then case job.job_type when 'lens' then 'Entregado al cristalero' else 'Entregado al montador' end
        when 'in_production' then 'Fabricación iniciada · Cristalero'
        when 'in_mounting' then 'Montaje iniciado · Montador'
        when 'completed' then case job.job_type when 'lens' then 'Cristales listos · Cristalero' else 'Montaje listo · Montador' end
        when 'received' then 'Recibido por la óptica'
        when 'reviewed' then 'Revisado por la óptica'
        when 'incident' then 'Incidencia reportada'
        else 'Estado de producción actualizado'
      end,
      coalesce(production_event.notes, case job.job_type when 'lens' then 'Cristales' else 'Montaje' end),
      production_event.actor_id, production_event.occurred_at,
      jsonb_build_object('jobId', job.id, 'jobType', job.job_type, 'fromStatus', production_event.from_status, 'toStatus', production_event.to_status)
    from public.production_job_events production_event
    join public.production_jobs job on job.id = production_event.job_id
    where job.order_id = sale_order.id
    union all
    select 'incident:' || incident.id, 'incident', 'Incidencia de producción',
      incident.description, incident.opened_by, incident.opened_at,
      jsonb_build_object('responsibility', incident.cost_responsibility, 'reworkJobId', incident.rework_job_id)
    from public.production_incidents incident
    join public.production_jobs job on job.id = incident.job_id
    where job.order_id = sale_order.id
    union all
    select 'notification:' || attempt.id, 'notification',
      case attempt.outcome
        when 'opened' then 'WhatsApp preparado'
        when 'sent' then 'WhatsApp enviado'
        else 'Intento de WhatsApp fallido'
      end,
      template.name, attempt.attempted_by, attempt.attempted_at,
      jsonb_build_object(
        'outcome', attempt.outcome,
        'provider', attempt.provider_key,
        'providerMessageId', attempt.provider_message_id,
        'failureCode', attempt.failure_code
      )
    from public.notification_attempts attempt
    join public.notification_templates template on template.key = attempt.template_key
    where attempt.order_id = sale_order.id
    union all
    select 'delivery:' || sale_order.id, 'delivery', 'Pedido entregado', sale_order.order_number,
      null::uuid, sale_order.delivered_at, '{}'::jsonb
    where sale_order.delivered_at is not null
  ) timeline
  left join public.profiles profile on profile.user_id = timeline.actor_id;

  return result;
end;
$$;
