-- Daily seller cashboxes with immutable primary and complementary closures.
create table public.seller_cashboxes (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id),
  branch_id bigint not null,
  seller_id uuid not null references auth.users(id),
  business_date date not null,
  currency text not null check (currency in ('CUP', 'USD')),
  created_at timestamptz not null default now(),
  unique (organization_id, branch_id, seller_id, business_date, currency),
  unique (id, organization_id, branch_id, seller_id, business_date, currency),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id)
);

create table public.cashbox_closures (
  id bigint generated always as identity primary key,
  cashbox_id bigint not null,
  organization_id bigint not null,
  branch_id bigint not null,
  seller_id uuid not null references auth.users(id),
  business_date date not null,
  currency text not null check (currency in ('CUP', 'USD')),
  closure_type text not null check (closure_type in ('primary', 'complementary')),
  sequence_number integer not null check (sequence_number >= 0),
  expected_amount numeric(14,2) not null check (expected_amount >= 0),
  declared_amount numeric(14,2) not null check (declared_amount >= 0),
  difference_amount numeric(14,2) generated always as (declared_amount - expected_amount) stored,
  closed_by uuid not null references auth.users(id),
  closed_at timestamptz not null default now(),
  unique (cashbox_id, sequence_number),
  foreign key (cashbox_id, organization_id, branch_id, seller_id, business_date, currency)
    references public.seller_cashboxes(id, organization_id, branch_id, seller_id, business_date, currency),
  check (
    (closure_type = 'primary' and sequence_number = 0)
    or (closure_type = 'complementary' and sequence_number > 0)
  )
);

create table public.cashbox_closure_payments (
  closure_id bigint not null references public.cashbox_closures(id),
  payment_id bigint not null unique references public.payments(id),
  allocated_amount numeric(14,2) not null check (allocated_amount > 0),
  allocated_at timestamptz not null default now(),
  primary key (closure_id, payment_id)
);

alter table public.payments
  add column cashbox_id bigint,
  add column business_date date;

create index seller_cashboxes_seller_date_idx
  on public.seller_cashboxes (seller_id, business_date desc);
create index seller_cashboxes_organization_date_idx
  on public.seller_cashboxes (organization_id, business_date desc, branch_id, seller_id);
create index seller_cashboxes_branch_fk_idx on public.seller_cashboxes (branch_id);
create index cashbox_closures_cashbox_closed_idx
  on public.cashbox_closures (cashbox_id, closed_at desc);
create index cashbox_closures_organization_date_idx
  on public.cashbox_closures (organization_id, business_date desc, branch_id, seller_id);
create index cashbox_closures_branch_fk_idx on public.cashbox_closures (branch_id);
create index cashbox_closures_seller_fk_idx on public.cashbox_closures (seller_id);
create index cashbox_closures_actor_fk_idx on public.cashbox_closures (closed_by);

create or replace function private.reject_cashbox_history_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'Los pagos y cierres de caja son inmutables.';
end;
$$;

create trigger seller_cashboxes_immutable before update or delete on public.seller_cashboxes
for each row execute function private.reject_cashbox_history_change();
create trigger cashbox_closures_immutable before update or delete on public.cashbox_closures
for each row execute function private.reject_cashbox_history_change();
create trigger cashbox_closure_payments_immutable before update or delete on public.cashbox_closure_payments
for each row execute function private.reject_cashbox_history_change();

create or replace function private.prepare_cash_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  sale_order public.orders%rowtype;
  paid_cup numeric(14,2);
  remaining_cup numeric(14,2);
  incoming_cup numeric(14,2);
  target_cashbox_id bigint;
  organization_timezone text;
begin
  select * into sale_order from public.orders where id = new.order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Pedido no encontrado.'; end if;
  if not private.can_write_seller_sale(sale_order.organization_id, sale_order.branch_id, sale_order.primary_seller_id) then
    raise exception using errcode = '42501', message = 'No puedes registrar pagos para este pedido.';
  end if;
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = sale_order.organization_id
      and membership.branch_id = sale_order.branch_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'seller'
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Solo un vendedor activo de la sucursal puede recibir efectivo.';
  end if;
  if not private.can_operate_in_organization(sale_order.organization_id, 'cashbox') then
    raise exception using errcode = '42501', message = 'El modulo Caja no esta operativo.';
  end if;
  if sale_order.commercial_status = 'closed' then
    raise exception using errcode = '55000', message = 'El pedido esta cerrado.';
  end if;

  new.organization_id := sale_order.organization_id;
  new.branch_id := sale_order.branch_id;
  new.received_by := (select auth.uid());
  new.payment_method := 'cash';
  new.received_at := now();
  select organization.timezone into organization_timezone
  from public.organizations organization where organization.id = new.organization_id;
  new.business_date := (new.received_at at time zone organization_timezone)::date;

  insert into public.seller_cashboxes (
    organization_id, branch_id, seller_id, business_date, currency
  ) values (
    new.organization_id, new.branch_id, new.received_by, new.business_date, new.currency
  )
  on conflict (organization_id, branch_id, seller_id, business_date, currency) do nothing
  returning id into target_cashbox_id;

  if target_cashbox_id is null then
    select id into target_cashbox_id from public.seller_cashboxes
    where organization_id = new.organization_id
      and branch_id = new.branch_id
      and seller_id = new.received_by
      and business_date = new.business_date
      and currency = new.currency;
  end if;

  perform 1 from public.seller_cashboxes where id = target_cashbox_id for update;
  new.cashbox_id := target_cashbox_id;
  new.is_post_close := exists (
    select 1 from public.cashbox_closures closure
    where closure.cashbox_id = target_cashbox_id and closure.closure_type = 'primary'
  );

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

-- Backfill any payments that predate cashboxes before enforcing the relationship.
update public.payments payment
set business_date = (payment.received_at at time zone organization.timezone)::date
from public.organizations organization
where organization.id = payment.organization_id and payment.business_date is null;

insert into public.seller_cashboxes (organization_id, branch_id, seller_id, business_date, currency)
select distinct organization_id, branch_id, received_by, business_date, currency
from public.payments
on conflict (organization_id, branch_id, seller_id, business_date, currency) do nothing;

update public.payments payment
set cashbox_id = cashbox.id
from public.seller_cashboxes cashbox
where cashbox.organization_id = payment.organization_id
  and cashbox.branch_id = payment.branch_id
  and cashbox.seller_id = payment.received_by
  and cashbox.business_date = payment.business_date
  and cashbox.currency = payment.currency
  and payment.cashbox_id is null;

create trigger payments_immutable before update or delete on public.payments
for each row execute function private.reject_cashbox_history_change();

create or replace function private.close_seller_cashbox(
  target_cashbox_id bigint,
  target_closure_type text,
  target_declared_amount numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_cashbox public.seller_cashboxes%rowtype;
  next_sequence integer;
  target_expected numeric(14,2);
  created_closure_id bigint;
  allocated_count integer;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesion.';
  end if;
  if target_closure_type not in ('primary', 'complementary') then
    raise exception using errcode = '22023', message = 'Tipo de cierre no valido.';
  end if;
  if target_declared_amount is null or target_declared_amount < 0 then
    raise exception using errcode = '22023', message = 'El importe declarado no es valido.';
  end if;

  select * into target_cashbox from public.seller_cashboxes
  where id = target_cashbox_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Caja no encontrada.'; end if;
  if target_cashbox.seller_id <> (select auth.uid())
    or not private.has_organization_role(target_cashbox.organization_id, array['seller'])
    or not private.can_operate_in_organization(target_cashbox.organization_id, 'cashbox') then
    raise exception using errcode = '42501', message = 'Solo el vendedor puede cerrar su propia caja operativa.';
  end if;

  if target_closure_type = 'primary' then
    if exists (select 1 from public.cashbox_closures where cashbox_id = target_cashbox.id and closure_type = 'primary') then
      raise exception using errcode = '23505', message = 'La caja ya tiene un cierre principal.';
    end if;
    next_sequence := 0;
  else
    if not exists (select 1 from public.cashbox_closures where cashbox_id = target_cashbox.id and closure_type = 'primary') then
      raise exception using errcode = '55000', message = 'Primero debes crear el cierre principal.';
    end if;
    select coalesce(max(sequence_number), 0) + 1 into next_sequence
    from public.cashbox_closures where cashbox_id = target_cashbox.id;
  end if;

  perform payment.id
  from public.payments payment
  left join public.cashbox_closure_payments allocation on allocation.payment_id = payment.id
  where payment.cashbox_id = target_cashbox.id
    and allocation.payment_id is null
    and (target_closure_type = 'primary' or payment.is_post_close)
  order by payment.id
  for update of payment;

  select coalesce(sum(payment.amount), 0), count(payment.id)::integer
  into target_expected, allocated_count
  from public.payments payment
  left join public.cashbox_closure_payments allocation on allocation.payment_id = payment.id
  where payment.cashbox_id = target_cashbox.id
    and allocation.payment_id is null
    and (target_closure_type = 'primary' or payment.is_post_close);

  if target_closure_type = 'complementary' and allocated_count = 0 then
    raise exception using errcode = '55000', message = 'No hay pagos posteriores pendientes de cierre.';
  end if;

  insert into public.cashbox_closures (
    cashbox_id, organization_id, branch_id, seller_id, business_date, currency,
    closure_type, sequence_number, expected_amount, declared_amount, closed_by
  ) values (
    target_cashbox.id, target_cashbox.organization_id, target_cashbox.branch_id,
    target_cashbox.seller_id, target_cashbox.business_date, target_cashbox.currency,
    target_closure_type, next_sequence, target_expected, round(target_declared_amount, 2), (select auth.uid())
  ) returning id into created_closure_id;

  insert into public.cashbox_closure_payments (closure_id, payment_id, allocated_amount)
  select created_closure_id, payment.id, payment.amount
  from public.payments payment
  left join public.cashbox_closure_payments allocation on allocation.payment_id = payment.id
  where payment.cashbox_id = target_cashbox.id
    and allocation.payment_id is null
    and (target_closure_type = 'primary' or payment.is_post_close)
  order by payment.id;

  return jsonb_build_object(
    'closureId', created_closure_id,
    'sequenceNumber', next_sequence,
    'expectedAmount', target_expected,
    'declaredAmount', round(target_declared_amount, 2),
    'differenceAmount', round(target_declared_amount, 2) - target_expected,
    'paymentCount', allocated_count
  );
end;
$$;

alter table public.payments
  alter column cashbox_id set not null,
  alter column business_date set not null,
  add foreign key (cashbox_id, organization_id, branch_id, received_by, business_date, currency)
    references public.seller_cashboxes(id, organization_id, branch_id, seller_id, business_date, currency);

create index payments_cashbox_received_idx on public.payments (cashbox_id, received_at, id);
create index payments_business_date_receiver_idx on public.payments (business_date desc, received_by);

create or replace function public.get_order_payment_summary(target_order_id bigint)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'orderId', sale_order.id, 'orderNumber', sale_order.order_number,
    'totalCup', sale_order.cup_equivalent,
    'paidCup', coalesce(sum(payment.equivalent_cup), 0),
    'balanceCup', greatest(sale_order.cup_equivalent - coalesce(sum(payment.equivalent_cup), 0), 0),
    'paymentStatus', sale_order.payment_status,
    'commercialStatus', sale_order.commercial_status,
    'saleRate', sale_order.usd_to_cup_rate,
    'payments', coalesce(jsonb_agg(jsonb_build_object(
      'id', payment.id, 'amount', payment.amount, 'currency', payment.currency,
      'appliedRate', payment.applied_rate, 'equivalentCup', payment.equivalent_cup,
      'receivedAt', payment.received_at, 'isPostClose', payment.is_post_close
    ) order by payment.received_at) filter (where payment.id is not null), '[]'::jsonb)
  ) into result
  from public.orders sale_order left join public.payments payment on payment.order_id = sale_order.id
  where sale_order.id = target_order_id
  group by sale_order.id;
  if result is null then raise exception using errcode = 'P0002', message = 'Pedido no disponible.'; end if;
  return result;
end;
$$;

alter table public.seller_cashboxes enable row level security;
alter table public.cashbox_closures enable row level security;
alter table public.cashbox_closure_payments enable row level security;

create policy seller_cashboxes_select on public.seller_cashboxes for select to authenticated
using ((select private.can_access_seller_sale(organization_id, branch_id, seller_id)));
create policy cashbox_closures_select on public.cashbox_closures for select to authenticated
using ((select private.can_access_seller_sale(organization_id, branch_id, seller_id)));
create policy cashbox_closure_payments_select on public.cashbox_closure_payments for select to authenticated
using (exists (
  select 1 from public.cashbox_closures closure where closure.id = closure_id
));

revoke all on public.seller_cashboxes, public.cashbox_closures, public.cashbox_closure_payments from anon, authenticated;
grant select on public.seller_cashboxes, public.cashbox_closures, public.cashbox_closure_payments to authenticated;
revoke all on function private.close_seller_cashbox(bigint, text, numeric) from public, anon;
grant execute on function private.close_seller_cashbox(bigint, text, numeric) to authenticated;

create or replace function public.close_cashbox(
  target_cashbox_id bigint,
  closure_type text,
  declared_amount numeric
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.close_seller_cashbox(target_cashbox_id, closure_type, declared_amount);
$$;

create or replace function public.list_accessible_cashboxes(
  target_business_date date default null,
  target_branch_id bigint default null,
  target_seller_id uuid default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cashbox.id,
    'organizationId', cashbox.organization_id,
    'branchId', cashbox.branch_id,
    'branchName', branch.name,
    'sellerId', cashbox.seller_id,
    'sellerName', coalesce(profile.display_name, cashbox.seller_id::text),
    'businessDate', cashbox.business_date,
    'currency', cashbox.currency,
    'receivedAmount', coalesce(payment_totals.received_amount, 0),
    'paymentCount', coalesce(payment_totals.payment_count, 0),
    'pendingPostCloseAmount', coalesce(payment_totals.pending_post_close_amount, 0),
    'primaryClosed', coalesce(closure_totals.primary_closed, false),
    'closedExpectedAmount', coalesce(closure_totals.expected_amount, 0),
    'closedDeclaredAmount', coalesce(closure_totals.declared_amount, 0),
    'closedDifferenceAmount', coalesce(closure_totals.difference_amount, 0),
    'closures', coalesce(closure_totals.closures, '[]'::jsonb)
  ) order by cashbox.business_date desc, branch.name, profile.display_name, cashbox.currency), '[]'::jsonb)
  from public.seller_cashboxes cashbox
  join public.branches branch on branch.id = cashbox.branch_id
  join public.profiles profile on profile.user_id = cashbox.seller_id
  left join lateral (
    select sum(payment.amount) as received_amount,
      count(*)::integer as payment_count,
      sum(payment.amount) filter (
        where payment.is_post_close and allocation.payment_id is null
      ) as pending_post_close_amount
    from public.payments payment
    left join public.cashbox_closure_payments allocation on allocation.payment_id = payment.id
    where payment.cashbox_id = cashbox.id
  ) payment_totals on true
  left join lateral (
    select bool_or(closure.closure_type = 'primary') as primary_closed,
      sum(closure.expected_amount) as expected_amount,
      sum(closure.declared_amount) as declared_amount,
      sum(closure.difference_amount) as difference_amount,
      jsonb_agg(jsonb_build_object(
        'id', closure.id,
        'type', closure.closure_type,
        'sequenceNumber', closure.sequence_number,
        'expectedAmount', closure.expected_amount,
        'declaredAmount', closure.declared_amount,
        'differenceAmount', closure.difference_amount,
        'closedAt', closure.closed_at
      ) order by closure.sequence_number) as closures
    from public.cashbox_closures closure where closure.cashbox_id = cashbox.id
  ) closure_totals on true
  where (target_business_date is null or cashbox.business_date = target_business_date)
    and (target_branch_id is null or cashbox.branch_id = target_branch_id)
    and (target_seller_id is null or cashbox.seller_id = target_seller_id);
$$;

revoke all on function public.close_cashbox(bigint, text, numeric), public.list_accessible_cashboxes(date, bigint, uuid) from public, anon;
grant execute on function public.close_cashbox(bigint, text, numeric), public.list_accessible_cashboxes(date, bigint, uuid) to authenticated;
