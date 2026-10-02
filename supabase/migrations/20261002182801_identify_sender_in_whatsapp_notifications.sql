-- Customers receive notices from the app's WhatsApp number, not the shop's, so every
-- message now names the shop and signs with the person who acted and a phone to call
-- (their profile phone, else the owner's). Payment notices state the amount paid and
-- amounts use the app's es-CU format ("54 100", "16,67").

create or replace function private.format_amount_es(value numeric)
returns text language plpgsql immutable set search_path = '' as $$
declare
  rounded numeric := round(abs(coalesce(value, 0)), 2);
  cents text := rtrim(lpad(((rounded - trunc(rounded)) * 100)::integer::text, 2, '0'), '0');
begin
  return case when coalesce(value, 0) < 0 then '-' else '' end
    || regexp_replace(trunc(rounded)::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g')
    || case when cents = '' then '' else ',' || cents end;
end;
$$;

update public.notification_templates set body_template = case key
  when 'order_accepted' then 'Hola {{customer_name}}. En {{store_name}} confirmamos tu pedido {{order_number}}. Te avisaremos cuando avance.'
  when 'order_ready' then 'Hola {{customer_name}}. Tu pedido {{order_number}} ya está listo para recoger en {{store_name}}. Saldo pendiente: {{balance_cup}} CUP.'
  when 'payment_received' then 'Hola {{customer_name}}. {{store_name}} registró tu pago de {{payment_amount}} para el pedido {{order_number}}. Saldo pendiente: {{balance_cup}} CUP.'
  when 'order_delivered' then 'Hola {{customer_name}}. Tu pedido {{order_number}} fue entregado. ¡Gracias por elegir {{store_name}}!'
  else body_template
end
where key in ('order_accepted', 'order_ready', 'payment_received', 'order_delivered');

create or replace function public.get_automatic_notification_payload(target_dispatch_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  dispatch private.notification_dispatches%rowtype;
  sale_order public.orders%rowtype;
  customer public.customers%rowtype;
  template public.notification_templates%rowtype;
  store_name text;
  sender_name text;
  sender_phone text;
  payment_label text;
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
  select organization.name into store_name from public.organizations organization
    where organization.id = sale_order.organization_id;
  select profile.display_name, nullif(btrim(profile.phone), '') into sender_name, sender_phone
    from public.profiles profile where profile.user_id = dispatch.actor_id;
  if sender_phone is null then
    select nullif(btrim(profile.phone), '') into sender_phone
    from public.organization_memberships membership
    join public.profiles profile on profile.user_id = membership.user_id
    where membership.organization_id = sale_order.organization_id
      and membership.role = 'owner' and membership.status = 'active'
      and nullif(btrim(profile.phone), '') is not null
    order by membership.id
    limit 1;
  end if;

  if dispatch.template_key = 'payment_received' then
    select private.format_amount_es(payment.amount) || ' ' || payment.currency into payment_label
    from public.payments payment
    where payment.order_id = sale_order.id
      and payment.id::text = split_part(dispatch.source_event_key, ':', 2);
  end if;

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

  rendered := replace(replace(replace(replace(replace(template.body_template,
    '{{customer_name}}', customer.full_name),
    '{{order_number}}', sale_order.order_number),
    '{{balance_cup}}', private.format_amount_es(balance)),
    '{{store_name}}', coalesce(store_name, 'la óptica')),
    '{{payment_amount}}', coalesce(payment_label, 'efectivo'));
  rendered := rendered || E'\n\n' || case
    when sender_phone is not null then
      'Te atendió ' || coalesce(sender_name, store_name) || '. Si tienes dudas, escríbele al '
      || sender_phone || '; este número solo envía avisos.'
    else
      'Te atendió ' || coalesce(sender_name, 'el equipo') || ' de ' || coalesce(store_name, 'la óptica')
      || '. Este número solo envía avisos.'
  end;

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
