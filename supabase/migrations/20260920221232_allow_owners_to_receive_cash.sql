-- Organization owners administer every active branch and may receive cash just
-- like an assigned seller. The cashbox remains attributed to the authenticated
-- person who physically records the payment.
create or replace function private.prepare_cash_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale_order public.orders%rowtype;
  paid_cup numeric(14,2);
  remaining_cup numeric(14,2);
  incoming_cup numeric(14,2);
  target_cashbox_id bigint;
  organization_timezone text;
begin
  select * into sale_order
  from public.orders
  where id = new.order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido no encontrado.';
  end if;

  if not private.can_write_seller_sale(
    sale_order.organization_id,
    sale_order.branch_id,
    sale_order.primary_seller_id
  ) then
    raise exception using errcode = '42501', message = 'No puedes registrar pagos para este pedido.';
  end if;

  if not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = sale_order.organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and (
        membership.role = 'owner'
        or (
          membership.role = 'seller'
          and membership.branch_id = sale_order.branch_id
        )
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'Solo el propietario de la organización o un vendedor activo de la sucursal puede recibir efectivo.';
  end if;

  if not private.can_operate_in_organization(sale_order.organization_id, 'cashbox') then
    raise exception using errcode = '42501', message = 'El módulo Caja no está operativo.';
  end if;

  if sale_order.commercial_status = 'closed' then
    raise exception using errcode = '55000', message = 'El pedido está cerrado.';
  end if;

  new.organization_id := sale_order.organization_id;
  new.branch_id := sale_order.branch_id;
  new.received_by := (select auth.uid());
  new.payment_method := 'cash';
  new.received_at := now();

  select organization.timezone into organization_timezone
  from public.organizations organization
  where organization.id = new.organization_id;

  new.business_date := (new.received_at at time zone organization_timezone)::date;

  insert into public.seller_cashboxes (
    organization_id,
    branch_id,
    seller_id,
    business_date,
    currency
  ) values (
    new.organization_id,
    new.branch_id,
    new.received_by,
    new.business_date,
    new.currency
  )
  on conflict (organization_id, branch_id, seller_id, business_date, currency) do nothing
  returning id into target_cashbox_id;

  if target_cashbox_id is null then
    select id into target_cashbox_id
    from public.seller_cashboxes
    where organization_id = new.organization_id
      and branch_id = new.branch_id
      and seller_id = new.received_by
      and business_date = new.business_date
      and currency = new.currency;
  end if;

  perform 1
  from public.seller_cashboxes
  where id = target_cashbox_id
  for update;

  new.cashbox_id := target_cashbox_id;
  new.is_post_close := exists (
    select 1
    from public.cashbox_closures closure
    where closure.cashbox_id = target_cashbox_id
      and closure.closure_type = 'primary'
  );

  select coalesce(sum(payment.equivalent_cup), 0) into paid_cup
  from public.payments payment
  where payment.order_id = new.order_id;

  remaining_cup := greatest(coalesce(sale_order.cup_equivalent, 0) - paid_cup, 0);
  incoming_cup := round(
    new.amount * case when new.currency = 'USD' then new.applied_rate else 1 end,
    2
  );

  if incoming_cup > remaining_cup then
    raise exception using errcode = '22003', message = 'El pago supera el saldo pendiente.';
  end if;

  return new;
end;
$$;
