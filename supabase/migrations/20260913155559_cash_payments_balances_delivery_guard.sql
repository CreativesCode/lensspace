-- Cash payments, derived balances and the zero-balance delivery invariant.
alter table public.orders add column delivered_at timestamptz;

create table public.payments (
  id bigint generated always as identity primary key,
  order_id bigint not null,
  organization_id bigint not null,
  branch_id bigint not null,
  received_by uuid not null references auth.users(id),
  payment_method text not null default 'cash' check (payment_method = 'cash'),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('CUP', 'USD')),
  applied_rate numeric(14,4) not null check (applied_rate > 0),
  equivalent_cup numeric(14,2) generated always as (
    round(amount * case when currency = 'USD' then applied_rate else 1 end, 2)
  ) stored,
  received_at timestamptz not null default now(),
  is_post_close boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 500),
  foreign key (order_id, organization_id, branch_id)
    references public.orders(id, organization_id, branch_id),
  check (currency <> 'CUP' or applied_rate = 1)
);

create index payments_order_received_idx on public.payments (order_id, received_at);
create index payments_order_parent_fk_idx on public.payments (order_id, organization_id, branch_id);
create index payments_receiver_received_idx on public.payments (received_by, received_at desc);
create index payments_organization_branch_received_idx on public.payments (organization_id, branch_id, received_at desc);

create or replace function private.prepare_cash_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  sale_order public.orders%rowtype;
  paid_cup numeric(14,2);
  remaining_cup numeric(14,2);
  incoming_cup numeric(14,2);
begin
  select * into sale_order from public.orders where id = new.order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Pedido no encontrado.'; end if;
  if not private.can_write_seller_sale(sale_order.organization_id, sale_order.branch_id, sale_order.primary_seller_id) then
    raise exception using errcode = '42501', message = 'No puedes registrar pagos para este pedido.';
  end if;
  if sale_order.commercial_status = 'closed' then
    raise exception using errcode = '55000', message = 'El pedido está cerrado.';
  end if;
  new.organization_id := sale_order.organization_id;
  new.branch_id := sale_order.branch_id;
  new.received_by := (select auth.uid());
  new.payment_method := 'cash';
  select coalesce(sum(payment.equivalent_cup), 0) into paid_cup
  from public.payments payment where payment.order_id = new.order_id;
  remaining_cup := greatest(coalesce(sale_order.cup_equivalent, 0) - paid_cup, 0);
  incoming_cup := round(new.amount * case when new.currency = 'USD' then new.applied_rate else 1 end, 2);
  if incoming_cup > remaining_cup then
    raise exception using errcode = '22003', message = 'El pago supera el saldo pendiente.';
  end if;
  return new;
end;
$$;

create or replace function private.refresh_order_payment_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_total numeric(14,2);
  paid_cup numeric(14,2);
begin
  select coalesce(cup_equivalent, 0) into target_total from public.orders where id = new.order_id;
  select coalesce(sum(equivalent_cup), 0) into paid_cup from public.payments where order_id = new.order_id;
  update public.orders set payment_status = case
    when paid_cup <= 0 then 'unpaid'
    when paid_cup >= target_total then 'paid'
    else 'partial'
  end where id = new.order_id;
  return new;
end;
$$;

create trigger payments_prepare before insert on public.payments
for each row execute function private.prepare_cash_payment();
create trigger payments_refresh_order after insert on public.payments
for each row execute function private.refresh_order_payment_status();

create or replace function private.guard_order_commercial_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  balance_cup numeric(14,2);
begin
  if not private.can_write_seller_sale(old.organization_id, old.branch_id, old.primary_seller_id) then
    raise exception using errcode = '42501', message = 'No puedes actualizar este pedido.';
  end if;
  if new.commercial_status is distinct from old.commercial_status then
    select greatest(coalesce(old.cup_equivalent, 0) - coalesce(sum(payment.equivalent_cup), 0), 0)
    into balance_cup from public.payments payment where payment.order_id = old.id;
    if new.commercial_status = 'delivered' and balance_cup > 0 then
      raise exception using errcode = '23514', message = 'No se puede entregar un pedido con saldo pendiente.';
    end if;
    if old.commercial_status = 'accepted' and new.commercial_status <> 'delivered' then
      raise exception using errcode = '23514', message = 'La siguiente transición comercial válida es entregado.';
    end if;
    if old.commercial_status = 'delivered' and new.commercial_status <> 'closed' then
      raise exception using errcode = '23514', message = 'La siguiente transición comercial válida es cerrado.';
    end if;
    if old.commercial_status = 'closed' then
      raise exception using errcode = '55000', message = 'El pedido cerrado no admite transiciones.';
    end if;
  end if;
  if new.commercial_status = 'delivered' and new.delivered_at is null then new.delivered_at := now(); end if;
  return new;
end;
$$;

create trigger orders_guard_commercial_transition
before update of commercial_status, delivered_at on public.orders
for each row execute function private.guard_order_commercial_transition();

alter table public.payments enable row level security;
create policy payments_select on public.payments for select to authenticated
using (exists (select 1 from public.orders sale_order where sale_order.id = order_id));
create policy payments_insert on public.payments for insert to authenticated
with check (
  received_by = (select auth.uid())
  and (select private.can_write_seller_sale(organization_id, branch_id, received_by))
  and exists (select 1 from public.orders sale_order where sale_order.id = order_id)
);
create policy orders_update_commercial on public.orders for update to authenticated
using ((select private.can_write_seller_sale(organization_id, branch_id, primary_seller_id)))
with check ((select private.can_write_seller_sale(organization_id, branch_id, primary_seller_id)));

revoke all on public.payments from anon, authenticated;
grant select, insert on public.payments to authenticated;
grant usage, select on sequence public.payments_id_seq to authenticated;
grant update (commercial_status, delivered_at) on public.orders to authenticated;

create or replace function public.register_cash_payment(
  target_order_id bigint,
  payment_amount numeric,
  payment_currency text,
  payment_applied_rate numeric,
  payment_notes text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  payment_id bigint;
  payment_equivalent numeric(14,2);
begin
  insert into public.payments (order_id, organization_id, branch_id, received_by, amount, currency, applied_rate, notes)
  values (target_order_id, 0, 0, (select auth.uid()), payment_amount, upper(payment_currency), payment_applied_rate, nullif(trim(payment_notes), ''))
  returning id, equivalent_cup into payment_id, payment_equivalent;
  return jsonb_build_object('paymentId', payment_id, 'equivalentCup', payment_equivalent);
end;
$$;

create or replace function public.get_order_payment_summary(target_order_id bigint)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'orderId', sale_order.id,
    'orderNumber', sale_order.order_number,
    'totalCup', coalesce(sale_order.cup_equivalent, 0),
    'paidCup', coalesce(sum(payment.equivalent_cup), 0),
    'balanceCup', greatest(coalesce(sale_order.cup_equivalent, 0) - coalesce(sum(payment.equivalent_cup), 0), 0),
    'paymentStatus', sale_order.payment_status,
    'commercialStatus', sale_order.commercial_status,
    'saleRate', sale_order.usd_to_cup_rate,
    'payments', coalesce(jsonb_agg(jsonb_build_object(
      'id', payment.id, 'amount', payment.amount, 'currency', payment.currency,
      'appliedRate', payment.applied_rate, 'equivalentCup', payment.equivalent_cup,
      'receivedAt', payment.received_at
    ) order by payment.received_at) filter (where payment.id is not null), '[]'::jsonb)
  ) into result
  from public.orders sale_order left join public.payments payment on payment.order_id = sale_order.id
  where sale_order.id = target_order_id
  group by sale_order.id;
  if result is null then raise exception using errcode = 'P0002', message = 'Pedido no disponible.'; end if;
  return result;
end;
$$;

create or replace function public.list_accessible_orders()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sale_order.id, 'orderNumber', sale_order.order_number,
    'customerName', customer.full_name, 'commercialStatus', sale_order.commercial_status,
    'paymentStatus', sale_order.payment_status, 'totalCup', sale_order.cup_equivalent,
    'createdAt', sale_order.created_at
  ) order by sale_order.created_at desc), '[]'::jsonb)
  from public.orders sale_order join public.customers customer on customer.id = sale_order.customer_id;
$$;

create or replace function public.mark_order_delivered(target_order_id bigint)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.orders set commercial_status = 'delivered', delivered_at = now()
  where id = target_order_id and commercial_status = 'accepted';
  if not found then raise exception using errcode = 'P0002', message = 'Pedido aceptado no disponible.'; end if;
end;
$$;

revoke all on function public.register_cash_payment(bigint, numeric, text, numeric, text), public.get_order_payment_summary(bigint), public.list_accessible_orders(), public.mark_order_delivered(bigint) from public, anon;
grant execute on function public.register_cash_payment(bigint, numeric, text, numeric, text), public.get_order_payment_summary(bigint), public.list_accessible_orders(), public.mark_order_delivered(bigint) to authenticated;
