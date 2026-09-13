-- Phase 6: immutable order history, owner analytics and a transport-neutral
-- boundary for manually initiated customer notifications.

create table public.notification_templates (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,49}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  body_template text not null check (char_length(btrim(body_template)) between 5 and 2000),
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.notification_attempts (
  id bigint generated always as identity primary key,
  order_id bigint not null,
  organization_id bigint not null,
  branch_id bigint not null,
  customer_id bigint not null,
  template_key text not null references public.notification_templates(key),
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  provider_key text not null default 'manual' check (provider_key ~ '^[a-z][a-z0-9_-]{1,49}$'),
  recipient_snapshot text,
  message_snapshot text not null check (char_length(message_snapshot) between 1 and 2000),
  outcome text not null check (outcome in ('opened', 'failed')),
  failure_code text check (failure_code is null or failure_code ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  failure_message text check (failure_message is null or char_length(failure_message) <= 500),
  attempted_by uuid not null references auth.users(id),
  attempted_at timestamptz not null default now(),
  foreign key (order_id, organization_id, branch_id)
    references public.orders(id, organization_id, branch_id),
  foreign key (customer_id, organization_id, branch_id)
    references public.customers(id, organization_id, branch_id),
  check (
    (outcome = 'opened' and recipient_snapshot is not null and failure_code is null and failure_message is null)
    or (outcome = 'failed' and failure_code is not null)
  )
);

create index notification_attempts_order_time_idx
  on public.notification_attempts (order_id, attempted_at, id);
create index notification_attempts_organization_time_idx
  on public.notification_attempts (organization_id, attempted_at desc);
create index notification_attempts_branch_time_idx
  on public.notification_attempts (branch_id, attempted_at desc);
create index notification_attempts_customer_fk_idx
  on public.notification_attempts (customer_id, organization_id, branch_id);
create index notification_attempts_actor_fk_idx
  on public.notification_attempts (attempted_by);
create index notification_attempts_template_fk_idx
  on public.notification_attempts (template_key);

insert into public.notification_templates (key, name, body_template) values
  ('order_accepted', 'Pedido confirmado', 'Hola {{customer_name}}. Tu pedido {{order_number}} fue confirmado. Te avisaremos cuando avance.'),
  ('order_ready', 'Pedido listo', 'Hola {{customer_name}}. Tu pedido {{order_number}} está listo. Saldo pendiente: {{balance_cup}} CUP.'),
  ('payment_received', 'Pago recibido', 'Hola {{customer_name}}. Registramos tu pago para el pedido {{order_number}}. Saldo pendiente: {{balance_cup}} CUP.'),
  ('order_delivered', 'Pedido entregado', 'Hola {{customer_name}}. Tu pedido {{order_number}} fue entregado. Gracias por elegirnos.');

create or replace function private.reject_notification_history_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'El historial de notificaciones es inmutable.';
end;
$$;

create trigger notification_attempts_immutable
before update or delete on public.notification_attempts
for each row execute function private.reject_notification_history_change();

alter table public.notification_templates enable row level security;
alter table public.notification_attempts enable row level security;

create policy notification_templates_select on public.notification_templates
for select to authenticated using (is_active);

create policy notification_attempts_select on public.notification_attempts
for select to authenticated
using (
  exists (
    select 1 from public.orders sale_order
    where sale_order.id = order_id
      and (select private.can_access_seller_sale(
        sale_order.organization_id,
        sale_order.branch_id,
        sale_order.primary_seller_id
      ))
  )
);

create policy notification_attempts_insert on public.notification_attempts
for insert to authenticated
with check (
  attempted_by = (select auth.uid())
  and exists (
    select 1 from public.orders sale_order
    where sale_order.id = order_id
      and (select private.can_write_seller_sale(
        sale_order.organization_id,
        sale_order.branch_id,
        sale_order.primary_seller_id
      ))
  )
  and (select private.can_operate_in_organization(organization_id, 'whatsapp'))
);

revoke all on public.notification_templates, public.notification_attempts from public, anon, authenticated;
grant select on public.notification_templates, public.notification_attempts to authenticated;
grant insert on public.notification_attempts to authenticated;
grant usage, select on sequence public.notification_attempts_id_seq to authenticated;

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
      case attempt.outcome when 'opened' then 'WhatsApp preparado' else 'Intento de WhatsApp fallido' end,
      template.name, attempt.attempted_by, attempt.attempted_at,
      jsonb_build_object('outcome', attempt.outcome, 'failureCode', attempt.failure_code)
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

create or replace function public.prepare_manual_notification(
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
  attempt_id bigint;
begin
  select * into sale_order from public.orders where id = target_order_id;
  if not found then raise exception using errcode = 'P0002', message = 'Pedido no encontrado o no accesible.'; end if;
  if not private.can_write_seller_sale(sale_order.organization_id, sale_order.branch_id, sale_order.primary_seller_id)
    or not private.can_operate_in_organization(sale_order.organization_id, 'whatsapp') then
    raise exception using errcode = '42501', message = 'WhatsApp no está operativo para este pedido.';
  end if;

  select * into customer from public.customers where id = sale_order.customer_id;
  select * into template from public.notification_templates where key = target_template_key and is_active;
  if not found then raise exception using errcode = 'P0002', message = 'Plantilla no encontrada.'; end if;

  select phone.normalized_phone into recipient
  from public.customer_phones phone
  where phone.customer_id = customer.id and phone.whatsapp_enabled
  order by phone.is_primary desc, phone.id
  limit 1;

  select greatest(coalesce(sale_order.cup_equivalent, 0) - coalesce(sum(payment.equivalent_cup), 0), 0)
  into balance from public.payments payment where payment.order_id = sale_order.id;
  rendered := replace(replace(replace(template.body_template,
    '{{customer_name}}', customer.full_name), '{{order_number}}', sale_order.order_number),
    '{{balance_cup}}', trim(to_char(balance, 'FM999999999990D00')));

  if not customer.messaging_consent then
    insert into public.notification_attempts (order_id, organization_id, branch_id, customer_id, template_key,
      recipient_snapshot, message_snapshot, outcome, failure_code, failure_message, attempted_by)
    values (sale_order.id, sale_order.organization_id, sale_order.branch_id, customer.id, template.key,
      null, rendered, 'failed', 'missing_consent', 'El cliente no autorizó mensajería.', (select auth.uid()))
    returning id into attempt_id;
    return jsonb_build_object('attemptId', attempt_id, 'outcome', 'failed', 'failureCode', 'missing_consent');
  end if;

  if recipient is null then
    insert into public.notification_attempts (order_id, organization_id, branch_id, customer_id, template_key,
      recipient_snapshot, message_snapshot, outcome, failure_code, failure_message, attempted_by)
    values (sale_order.id, sale_order.organization_id, sale_order.branch_id, customer.id, template.key,
      null, rendered, 'failed', 'missing_recipient', 'No existe un teléfono habilitado para WhatsApp.', (select auth.uid()))
    returning id into attempt_id;
    return jsonb_build_object('attemptId', attempt_id, 'outcome', 'failed', 'failureCode', 'missing_recipient');
  end if;

  insert into public.notification_attempts (order_id, organization_id, branch_id, customer_id, template_key,
    recipient_snapshot, message_snapshot, outcome, attempted_by)
  values (sale_order.id, sale_order.organization_id, sale_order.branch_id, customer.id, template.key,
    recipient, rendered, 'opened', (select auth.uid()))
  returning id into attempt_id;

  return jsonb_build_object(
    'attemptId', attempt_id,
    'outcome', 'opened',
    'provider', 'manual',
    'recipient', recipient,
    'message', rendered
  );
end;
$$;

create or replace function public.get_owner_dashboard(
  target_organization_id bigint,
  target_branch_id bigint default null,
  target_seller_id uuid default null,
  date_from date default (current_date - 29),
  date_to date default current_date
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if date_to < date_from or date_to - date_from > 366 then
    raise exception using errcode = '22023', message = 'El rango debe estar ordenado y no exceder 367 días.';
  end if;
  if not private.has_organization_role(target_organization_id, array['owner']) then
    raise exception using errcode = '42501', message = 'Solo el propietario puede consultar analítica.';
  end if;

  with filtered_orders as (
    select sale_order.*
    from public.orders sale_order
    where sale_order.organization_id = target_organization_id
      and (target_branch_id is null or sale_order.branch_id = target_branch_id)
      and (target_seller_id is null or sale_order.primary_seller_id = target_seller_id)
      and sale_order.accepted_at >= date_from::timestamptz
      and sale_order.accepted_at < (date_to + 1)::timestamptz
  ), payments_summary as (
    select coalesce(sum(payment.equivalent_cup), 0) collected_cup
    from public.payments payment join filtered_orders sale_order on sale_order.id = payment.order_id
  ), seller_totals as (
    select sale_order.primary_seller_id, coalesce(profile.display_name, 'Vendedor') seller_name,
      count(*) order_count, coalesce(sum(sale_order.cup_equivalent), 0) sales_cup
    from filtered_orders sale_order left join public.profiles profile on profile.user_id = sale_order.primary_seller_id
    group by sale_order.primary_seller_id, profile.display_name order by sales_cup desc
  ), provider_loads as (
    select job.provider_id, coalesce(profile.display_name, 'Proveedor') provider_name,
      job.job_type, count(*) filter (where job.is_current and job.status not in ('received', 'reviewed')) active_jobs
    from public.production_jobs job
    join filtered_orders sale_order on sale_order.id = job.order_id
    left join public.profiles profile on profile.user_id = job.provider_id
    group by job.provider_id, profile.display_name, job.job_type
  ), top_items as (
    select item.name, item.category, count(*) quantity
    from public.order_items item join filtered_orders sale_order on sale_order.id = item.order_id
    group by item.name, item.category order by quantity desc, item.name limit 8
  )
  select jsonb_build_object(
    'orders', jsonb_build_object(
      'total', count(*),
      'accepted', count(*) filter (where commercial_status = 'accepted'),
      'delivered', count(*) filter (where commercial_status = 'delivered'),
      'withIncidents', count(*) filter (where exists (
        select 1 from public.production_jobs job join public.production_incidents incident on incident.job_id = job.id
        where job.order_id = filtered_orders.id
      ))
    ),
    'salesCup', coalesce(sum(cup_equivalent), 0),
    'collectionsCup', (select collected_cup from payments_summary),
    'outstandingCup', coalesce(sum(greatest(coalesce(cup_equivalent, 0) - coalesce((
      select sum(payment.equivalent_cup) from public.payments payment where payment.order_id = filtered_orders.id
    ), 0), 0)), 0),
    'averageDeliveryHours', round((avg(extract(epoch from (delivered_at - accepted_at)) / 3600)
      filter (where delivered_at is not null))::numeric, 1),
    'cashDifferenceCup', coalesce((select sum(closure.difference_amount)
      from public.cashbox_closures closure
      where closure.organization_id = target_organization_id
        and closure.currency = 'CUP'
        and (target_branch_id is null or closure.branch_id = target_branch_id)
        and (target_seller_id is null or closure.seller_id = target_seller_id)
        and closure.business_date between date_from and date_to), 0),
    'bySeller', (select coalesce(jsonb_agg(to_jsonb(seller_totals)), '[]'::jsonb) from seller_totals),
    'providerLoads', (select coalesce(jsonb_agg(to_jsonb(provider_loads)), '[]'::jsonb) from provider_loads),
    'topItems', (select coalesce(jsonb_agg(to_jsonb(top_items)), '[]'::jsonb) from top_items)
  ) into result from filtered_orders;
  return result;
end;
$$;

revoke all on function public.get_order_timeline(bigint), public.prepare_manual_notification(bigint, text),
  public.get_owner_dashboard(bigint, bigint, uuid, date, date) from public, anon;
grant execute on function public.get_order_timeline(bigint), public.prepare_manual_notification(bigint, text),
  public.get_owner_dashboard(bigint, bigint, uuid, date, date) to authenticated;
