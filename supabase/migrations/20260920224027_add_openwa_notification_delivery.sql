-- Send audited order notifications through OpenWA without exposing provider
-- credentials to the browser. The Edge Function renders through the caller's
-- RLS-scoped session and records the final provider result with service_role.

alter table public.notification_attempts
  drop constraint notification_attempts_outcome_check,
  add constraint notification_attempts_outcome_check
    check (outcome in ('opened', 'sent', 'failed')),
  add column provider_message_id text,
  add column provider_chat_id text,
  add column source_event_key text;

alter table public.notification_attempts
  add constraint notification_attempts_provider_message_id_length
    check (provider_message_id is null or char_length(provider_message_id) <= 500),
  add constraint notification_attempts_provider_chat_id_length
    check (provider_chat_id is null or char_length(provider_chat_id) <= 200),
  add constraint notification_attempts_source_event_key_format
    check (source_event_key is null or source_event_key ~ '^[a-z][a-z0-9:_-]{2,199}$'),
  drop constraint notification_attempts_check,
  add constraint notification_attempts_result_check check (
    (outcome in ('opened', 'sent') and recipient_snapshot is not null
      and failure_code is null and failure_message is null)
    or (outcome = 'failed' and failure_code is not null)
  );

create unique index notification_attempts_source_event_key_idx
  on public.notification_attempts (source_event_key)
  where source_event_key is not null;

create or replace function public.prepare_openwa_notification(
  target_order_id bigint,
  target_template_key text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  sale_order public.orders%rowtype;
  customer public.customers%rowtype;
  template public.notification_templates%rowtype;
  recipient text;
  rendered text;
  balance numeric(14,2);
begin
  select * into sale_order from public.orders where id = target_order_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido no encontrado o no accesible.';
  end if;

  if not private.can_write_seller_sale(
      sale_order.organization_id,
      sale_order.branch_id,
      sale_order.primary_seller_id
    ) or not private.can_operate_in_organization(sale_order.organization_id, 'whatsapp') then
    raise exception using errcode = '42501', message = 'WhatsApp no está operativo para este pedido.';
  end if;

  select * into customer from public.customers where id = sale_order.customer_id;
  select * into template
  from public.notification_templates
  where key = target_template_key and is_active;
  if not found then
    raise exception using errcode = 'P0002', message = 'Plantilla no encontrada.';
  end if;

  select phone.normalized_phone into recipient
  from public.customer_phones phone
  where phone.customer_id = customer.id and phone.whatsapp_enabled
  order by phone.is_primary desc, phone.id
  limit 1;

  select greatest(
    coalesce(sale_order.cup_equivalent, 0) - coalesce(sum(payment.equivalent_cup), 0),
    0
  ) into balance
  from public.payments payment
  where payment.order_id = sale_order.id;

  rendered := replace(replace(replace(
    template.body_template,
    '{{customer_name}}', customer.full_name
  ), '{{order_number}}', sale_order.order_number),
    '{{balance_cup}}', trim(to_char(balance, 'FM999999999990D00')));

  return jsonb_build_object(
    'orderId', sale_order.id,
    'organizationId', sale_order.organization_id,
    'branchId', sale_order.branch_id,
    'customerId', customer.id,
    'templateKey', template.key,
    'actorId', (select auth.uid()),
    'recipient', recipient,
    'message', rendered,
    'failureCode', case
      when not customer.messaging_consent then 'missing_consent'
      when recipient is null then 'missing_recipient'
      else null
    end,
    'failureMessage', case
      when not customer.messaging_consent then 'El cliente no autorizó mensajería.'
      when recipient is null then 'No existe un teléfono habilitado para WhatsApp.'
      else null
    end
  );
end;
$$;

create extension if not exists pg_net with schema extensions;

create table private.notification_dispatches (
  id bigint generated always as identity primary key,
  source_event_key text not null unique check (source_event_key ~ '^[a-z][a-z0-9:_-]{2,199}$'),
  order_id bigint not null references public.orders(id),
  template_key text not null references public.notification_templates(key),
  actor_id uuid not null references auth.users(id),
  status text not null default 'requested' check (status in ('requested', 'sent', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_code text check (failure_code is null or failure_code ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  check (
    (status = 'requested' and completed_at is null and failure_code is null)
    or (status = 'sent' and completed_at is not null and failure_code is null)
    or (status = 'failed' and completed_at is not null and failure_code is not null)
  )
);

create index notification_dispatches_pending_idx
  on private.notification_dispatches (requested_at, id)
  where status = 'requested';

create or replace function private.queue_openwa_notification(
  target_order_id bigint,
  target_template_key text,
  target_actor_id uuid,
  target_source_event_key text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  dispatch_id bigint;
  project_url text;
  notify_secret text;
begin
  if target_actor_id is null then return; end if;

  insert into private.notification_dispatches (
    source_event_key, order_id, template_key, actor_id
  ) values (
    target_source_event_key, target_order_id, target_template_key, target_actor_id
  )
  on conflict (source_event_key) do nothing
  returning id into dispatch_id;

  if dispatch_id is null then return; end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'vision_studio_project_url';
  select decrypted_secret into notify_secret
  from vault.decrypted_secrets where name = 'vision_studio_wa_notify_secret';

  if nullif(project_url, '') is null or nullif(notify_secret, '') is null then
    raise warning 'OpenWA dispatch % queued without runtime configuration', dispatch_id;
    return;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/send-whatsapp-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wa-secret', notify_secret
    ),
    body := jsonb_build_object('dispatchId', dispatch_id),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'queue_openwa_notification failed for %: %', target_source_event_key, sqlerrm;
end;
$$;

create or replace function private.notify_order_accepted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.queue_openwa_notification(
    new.id, 'order_accepted', new.primary_seller_id, 'order_accepted:' || new.id
  );
  return new;
end;
$$;

create trigger orders_notify_accepted
after insert on public.orders
for each row execute function private.notify_order_accepted();

create or replace function private.notify_payment_received()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.queue_openwa_notification(
    new.order_id, 'payment_received', new.received_by, 'payment_received:' || new.id
  );
  return new;
end;
$$;

create trigger payments_notify_received
after insert on public.payments
for each row execute function private.notify_payment_received();

create or replace function private.notify_order_ready()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_order_id bigint;
begin
  if new.to_status not in ('received', 'reviewed') then return new; end if;

  select job.order_id into target_order_id
  from public.production_jobs job where job.id = new.job_id;

  if target_order_id is null
    or not exists (
      select 1 from public.production_jobs job
      where job.order_id = target_order_id and job.is_current
    )
    or exists (
      select 1 from public.production_jobs job
      where job.order_id = target_order_id and job.is_current
        and job.status not in ('received', 'reviewed')
    ) then
    return new;
  end if;

  perform private.queue_openwa_notification(
    target_order_id, 'order_ready', new.actor_id, 'order_ready:' || target_order_id
  );
  return new;
end;
$$;

create trigger production_events_notify_order_ready
after insert on public.production_job_events
for each row execute function private.notify_order_ready();

create or replace function private.notify_order_delivered()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.commercial_status = 'delivered'
    and new.commercial_status is distinct from old.commercial_status then
    perform private.queue_openwa_notification(
      new.id,
      'order_delivered',
      coalesce((select auth.uid()), new.primary_seller_id),
      'order_delivered:' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger orders_notify_delivered
after update of commercial_status on public.orders
for each row execute function private.notify_order_delivered();

create or replace function public.get_automatic_notification_payload(
  target_dispatch_id bigint
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  dispatch private.notification_dispatches%rowtype;
  sale_order public.orders%rowtype;
  customer public.customers%rowtype;
  template public.notification_templates%rowtype;
  recipient text;
  rendered text;
  balance numeric(14,2);
  module_available boolean;
begin
  select * into dispatch from private.notification_dispatches where id = target_dispatch_id;
  if not found then raise exception using errcode = 'P0002', message = 'Despacho no encontrado.'; end if;

  select * into sale_order from public.orders where id = dispatch.order_id;
  select * into customer from public.customers where id = sale_order.customer_id;
  select * into template from public.notification_templates
    where key = dispatch.template_key and is_active;

  select exists (
    select 1
    from public.organizations organization
    join public.subscriptions subscription on subscription.organization_id = organization.id
    join public.organization_modules organization_module
      on organization_module.organization_id = organization.id
      and organization_module.module_key = 'whatsapp'
      and organization_module.is_enabled
    join public.modules module on module.key = organization_module.module_key and module.is_active
    where organization.id = sale_order.organization_id
      and organization.status = 'active'
      and subscription.status in ('trial', 'active')
      and current_date between subscription.starts_on and subscription.expires_on
  ) into module_available;

  select phone.normalized_phone into recipient
  from public.customer_phones phone
  where phone.customer_id = customer.id and phone.whatsapp_enabled
  order by phone.is_primary desc, phone.id
  limit 1;

  select greatest(
    coalesce(sale_order.cup_equivalent, 0) - coalesce(sum(payment.equivalent_cup), 0), 0
  ) into balance from public.payments payment where payment.order_id = sale_order.id;

  rendered := replace(replace(replace(template.body_template,
    '{{customer_name}}', customer.full_name), '{{order_number}}', sale_order.order_number),
    '{{balance_cup}}', trim(to_char(balance, 'FM999999999990D00')));

  return jsonb_build_object(
    'dispatchId', dispatch.id,
    'sourceEventKey', dispatch.source_event_key,
    'dispatchStatus', dispatch.status,
    'orderId', sale_order.id,
    'organizationId', sale_order.organization_id,
    'branchId', sale_order.branch_id,
    'customerId', customer.id,
    'templateKey', template.key,
    'actorId', dispatch.actor_id,
    'recipient', recipient,
    'message', rendered,
    'failureCode', case
      when not module_available then 'module_unavailable'
      when not customer.messaging_consent then 'missing_consent'
      when recipient is null then 'missing_recipient'
      else null
    end,
    'failureMessage', case
      when not module_available then 'WhatsApp no está operativo para esta organización.'
      when not customer.messaging_consent then 'El cliente no autorizó mensajería.'
      when recipient is null then 'No existe un teléfono habilitado para WhatsApp.'
      else null
    end
  );
end;
$$;

create or replace function public.complete_automatic_notification_dispatch(
  target_dispatch_id bigint,
  target_outcome text,
  target_failure_code text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_outcome not in ('sent', 'failed')
    or (target_outcome = 'sent' and target_failure_code is not null)
    or (target_outcome = 'failed' and target_failure_code is null) then
    raise exception using errcode = '22023', message = 'Resultado de despacho inválido.';
  end if;

  update private.notification_dispatches
  set status = target_outcome,
      completed_at = now(),
      failure_code = target_failure_code
  where id = target_dispatch_id and status = 'requested';
end;
$$;

revoke all on table private.notification_dispatches from public, anon, authenticated;
revoke all on function private.queue_openwa_notification(bigint, text, uuid, text),
  private.notify_order_accepted(), private.notify_payment_received(),
  private.notify_order_ready(), private.notify_order_delivered()
  from public, anon, authenticated;
revoke all on function public.get_automatic_notification_payload(bigint)
  from public, anon, authenticated;
revoke all on function public.complete_automatic_notification_dispatch(bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.get_automatic_notification_payload(bigint)
  to service_role;
grant execute on function public.complete_automatic_notification_dispatch(bigint, text, text)
  to service_role;

revoke all on function public.prepare_openwa_notification(bigint, text)
  from public, anon;
grant execute on function public.prepare_openwa_notification(bigint, text)
  to authenticated;

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
    select 'production:' || production_event.id, 'production', 'Producción: ' || production_event.to_status,
      coalesce(production_event.notes, job.job_type), production_event.actor_id,
      production_event.occurred_at, jsonb_build_object('jobId', job.id, 'jobType', job.job_type, 'fromStatus', production_event.from_status)
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
