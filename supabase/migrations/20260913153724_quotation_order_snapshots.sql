-- Atomic quotation acceptance and immutable commercial snapshots.
create table public.quotations (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id),
  branch_id bigint not null,
  customer_id bigint not null,
  prescription_revision_id bigint,
  seller_id uuid not null references auth.users(id),
  status text not null default 'draft' check (status in ('draft', 'awaiting_acceptance', 'accepted', 'expired')),
  usd_to_cup_rate numeric(14,4) check (usd_to_cup_rate is null or usd_to_cup_rate > 0),
  totals jsonb not null default '{}'::jsonb check (jsonb_typeof(totals) = 'object'),
  cup_equivalent numeric(14,2) check (cup_equivalent is null or cup_equivalent >= 0),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (id, organization_id, branch_id),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id),
  foreign key (customer_id, organization_id, branch_id) references public.customers(id, organization_id, branch_id),
  foreign key (prescription_revision_id) references public.prescription_revisions(id)
);

create table public.quotation_items (
  id bigint generated always as identity primary key,
  quotation_id bigint not null,
  organization_id bigint not null,
  branch_id bigint not null,
  catalog_item_id bigint references public.catalog_items(id),
  line_kind text not null check (line_kind in ('catalog_item', 'graduation_surcharge')),
  source_code text,
  category text,
  name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  position smallint not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (quotation_id, position),
  foreign key (quotation_id, organization_id, branch_id)
    references public.quotations(id, organization_id, branch_id) on delete cascade
);

create table public.order_counters (
  organization_id bigint not null references public.organizations(id),
  order_year integer not null check (order_year between 2020 and 2200),
  last_value bigint not null default 0 check (last_value >= 0),
  primary key (organization_id, order_year)
);

create table public.orders (
  id bigint generated always as identity primary key,
  order_number text not null unique,
  organization_id bigint not null references public.organizations(id),
  branch_id bigint not null,
  customer_id bigint not null,
  prescription_revision_id bigint,
  quotation_id bigint not null unique,
  primary_seller_id uuid not null references auth.users(id),
  commercial_status text not null default 'accepted' check (commercial_status in ('accepted', 'delivered', 'closed')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  usd_to_cup_rate numeric(14,4) check (usd_to_cup_rate is null or usd_to_cup_rate > 0),
  totals jsonb not null check (jsonb_typeof(totals) = 'object'),
  cup_equivalent numeric(14,2) check (cup_equivalent is null or cup_equivalent >= 0),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, organization_id, branch_id),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id),
  foreign key (customer_id, organization_id, branch_id) references public.customers(id, organization_id, branch_id),
  foreign key (prescription_revision_id) references public.prescription_revisions(id),
  foreign key (quotation_id, organization_id, branch_id)
    references public.quotations(id, organization_id, branch_id)
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null,
  organization_id bigint not null,
  branch_id bigint not null,
  catalog_item_id bigint references public.catalog_items(id),
  line_kind text not null,
  source_code text,
  category text,
  name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  position smallint not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (order_id, position),
  foreign key (order_id, organization_id, branch_id)
    references public.orders(id, organization_id, branch_id)
);

create table public.order_confirmations (
  id bigint generated always as identity primary key,
  order_id bigint not null,
  organization_id bigint not null,
  branch_id bigint not null,
  confirmed_by uuid not null references auth.users(id),
  confirmation_method text not null default 'verbal' check (confirmation_method = 'verbal'),
  totals jsonb not null check (jsonb_typeof(totals) = 'object'),
  usd_to_cup_rate numeric(14,4),
  cup_equivalent numeric(14,2),
  confirmed_at timestamptz not null default now(),
  foreign key (order_id, organization_id, branch_id)
    references public.orders(id, organization_id, branch_id)
);

create index quotations_seller_updated_idx on public.quotations (seller_id, updated_at desc);
create index quotations_organization_branch_status_idx on public.quotations (organization_id, branch_id, status, updated_at desc);
create index quotation_items_quotation_idx on public.quotation_items (quotation_id);
create index orders_seller_created_idx on public.orders (primary_seller_id, created_at desc);
create index orders_organization_branch_status_idx on public.orders (organization_id, branch_id, commercial_status, created_at desc);
create index order_items_order_idx on public.order_items (order_id);
create index order_confirmations_order_idx on public.order_confirmations (order_id, confirmed_at desc);
create index order_confirmations_actor_idx on public.order_confirmations (confirmed_by);

create trigger quotations_set_updated_at before update on public.quotations
for each row execute function private.set_updated_at();

create or replace function private.can_access_seller_sale(
  target_organization_id bigint,
  target_branch_id bigint,
  target_seller_id uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin()
    or private.has_organization_role(target_organization_id, array['owner'])
    or exists (
      select 1 from public.organization_memberships membership
      where membership.organization_id = target_organization_id
        and membership.branch_id = target_branch_id
        and membership.user_id = (select auth.uid())
        and membership.user_id = target_seller_id
        and membership.role = 'seller'
        and membership.status = 'active'
    );
$$;

create or replace function private.can_write_seller_sale(
  target_organization_id bigint,
  target_branch_id bigint,
  target_seller_id uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_access_seller_sale(target_organization_id, target_branch_id, target_seller_id)
    and private.can_operate_in_organization(target_organization_id, 'optical_sales');
$$;

create or replace function private.reject_immutable_order_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'La instantánea aceptada del pedido es inmutable.';
end;
$$;

create trigger order_items_immutable before update or delete on public.order_items
for each row execute function private.reject_immutable_order_change();
create trigger order_confirmations_immutable before update or delete on public.order_confirmations
for each row execute function private.reject_immutable_order_change();

create or replace function private.next_order_number(target_organization_id bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare
  target_year integer := extract(year from current_date)::integer;
  next_value bigint;
  prefix text;
begin
  select order_prefix into prefix from public.organizations where id = target_organization_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Organización no encontrada.'; end if;
  insert into public.order_counters (organization_id, order_year, last_value)
  values (target_organization_id, target_year, 1)
  on conflict (organization_id, order_year) do update
    set last_value = public.order_counters.last_value + 1
  returning last_value into next_value;
  update public.organizations set first_order_created_at = coalesce(first_order_created_at, now())
  where id = target_organization_id;
  return prefix || '-' || target_year || '-' || lpad(next_value::text, 6, '0');
end;
$$;

alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.order_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_confirmations enable row level security;

create policy quotations_select on public.quotations for select to authenticated
using ((select private.can_access_seller_sale(organization_id, branch_id, seller_id)));
create policy quotations_insert on public.quotations for insert to authenticated
with check (seller_id = (select auth.uid()) and (select private.can_write_seller_sale(organization_id, branch_id, seller_id)));
create policy quotations_update on public.quotations for update to authenticated
using ((select private.can_write_seller_sale(organization_id, branch_id, seller_id)) and status <> 'accepted')
with check ((select private.can_write_seller_sale(organization_id, branch_id, seller_id)));
create policy quotation_items_select on public.quotation_items for select to authenticated
using (exists (select 1 from public.quotations quotation where quotation.id = quotation_id));
create policy quotation_items_insert on public.quotation_items for insert to authenticated
with check (exists (select 1 from public.quotations quotation where quotation.id = quotation_id and quotation.status <> 'accepted'));
create policy quotation_items_delete on public.quotation_items for delete to authenticated
using (exists (select 1 from public.quotations quotation where quotation.id = quotation_id and quotation.status <> 'accepted'));
create policy orders_select on public.orders for select to authenticated
using ((select private.can_access_seller_sale(organization_id, branch_id, primary_seller_id)));
create policy orders_insert on public.orders for insert to authenticated
with check ((select private.can_write_seller_sale(organization_id, branch_id, primary_seller_id)));
create policy order_items_select on public.order_items for select to authenticated
using (exists (select 1 from public.orders sale_order where sale_order.id = order_id));
create policy order_items_insert on public.order_items for insert to authenticated
with check (exists (select 1 from public.orders sale_order where sale_order.id = order_id));
create policy confirmations_select on public.order_confirmations for select to authenticated
using (exists (select 1 from public.orders sale_order where sale_order.id = order_id));
create policy confirmations_insert on public.order_confirmations for insert to authenticated
with check (confirmed_by = (select auth.uid()) and exists (select 1 from public.orders sale_order where sale_order.id = order_id));

revoke all on public.quotations, public.quotation_items, public.order_counters, public.orders, public.order_items, public.order_confirmations from anon, authenticated;
grant select, insert on public.quotations, public.quotation_items, public.orders, public.order_items, public.order_confirmations to authenticated;
grant update (status, usd_to_cup_rate, totals, cup_equivalent, warnings, notes, updated_at, accepted_at) on public.quotations to authenticated;
grant delete on public.quotation_items to authenticated;
grant usage, select on sequence public.quotations_id_seq, public.quotation_items_id_seq, public.orders_id_seq, public.order_items_id_seq, public.order_confirmations_id_seq to authenticated;
grant execute on function private.can_access_seller_sale(bigint, bigint, uuid), private.can_write_seller_sale(bigint, bigint, uuid), private.next_order_number(bigint) to authenticated;

create or replace function public.save_quotation(
  target_quotation_id bigint,
  target_organization_id bigint,
  target_branch_id bigint,
  target_customer_id bigint,
  target_prescription_revision_id bigint,
  selected_item_ids bigint[],
  target_usd_to_cup_rate numeric,
  target_notes text default null
) returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  quote_id bigint;
  pricing jsonb;
  line jsonb;
  line_position smallint := 0;
begin
  if not private.can_write_seller_sale(target_organization_id, target_branch_id, (select auth.uid())) then
    raise exception using errcode = '42501', message = 'No puedes guardar cotizaciones en esta sucursal.';
  end if;
  if not exists (select 1 from public.customers where id = target_customer_id and organization_id = target_organization_id and branch_id = target_branch_id) then
    raise exception using errcode = 'P0002', message = 'Cliente no disponible.';
  end if;
  pricing := public.calculate_catalog_price(target_organization_id, selected_item_ids, target_prescription_revision_id, target_usd_to_cup_rate);
  if target_quotation_id is null then
    insert into public.quotations (organization_id, branch_id, customer_id, prescription_revision_id, seller_id, status, usd_to_cup_rate, totals, cup_equivalent, warnings, notes)
    values (target_organization_id, target_branch_id, target_customer_id, target_prescription_revision_id, (select auth.uid()), 'awaiting_acceptance', target_usd_to_cup_rate, pricing->'totals', (pricing->>'cupEquivalent')::numeric, pricing->'warnings', nullif(trim(target_notes), ''))
    returning id into quote_id;
  else
    update public.quotations set customer_id = target_customer_id, prescription_revision_id = target_prescription_revision_id,
      status = 'awaiting_acceptance', usd_to_cup_rate = target_usd_to_cup_rate, totals = pricing->'totals',
      cup_equivalent = (pricing->>'cupEquivalent')::numeric, warnings = pricing->'warnings', notes = nullif(trim(target_notes), '')
    where id = target_quotation_id and organization_id = target_organization_id and branch_id = target_branch_id and seller_id = (select auth.uid()) and status <> 'accepted'
    returning id into quote_id;
    if quote_id is null then raise exception using errcode = 'P0002', message = 'Cotización editable no encontrada.'; end if;
    delete from public.quotation_items where quotation_id = quote_id;
  end if;
  for line in select value from jsonb_array_elements(pricing->'lineItems') loop
    line_position := line_position + 1;
    insert into public.quotation_items (quotation_id, organization_id, branch_id, catalog_item_id, line_kind, source_code, category, name, amount, currency, position)
    values (quote_id, target_organization_id, target_branch_id, (line->>'itemId')::bigint, line->>'kind', coalesce(line->>'code', line->>'ruleCode'), line->>'category', line->>'name', (line->>'amount')::numeric, line->>'currency', line_position);
  end loop;
  return quote_id;
end;
$$;

create or replace function public.accept_quotation(target_quotation_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  quotation_record public.quotations%rowtype;
  current_pricing jsonb;
  snapshot_lines jsonb;
  current_lines jsonb;
  item_ids bigint[];
  new_order_id bigint;
  new_order_number text;
begin
  select * into quotation_record from public.quotations where id = target_quotation_id for update;
  if not found or quotation_record.status <> 'awaiting_acceptance' then
    raise exception using errcode = 'P0002', message = 'Cotización pendiente no encontrada.';
  end if;
  if not private.can_write_seller_sale(quotation_record.organization_id, quotation_record.branch_id, quotation_record.seller_id) then
    raise exception using errcode = '42501', message = 'No puedes aceptar esta cotización.';
  end if;
  select array_agg(catalog_item_id order by position) filter (where catalog_item_id is not null),
    jsonb_agg(jsonb_build_object('kind', line_kind, 'itemId', catalog_item_id, 'code', source_code, 'name', name, 'category', category, 'amount', amount, 'currency', currency) order by position)
  into item_ids, snapshot_lines from public.quotation_items where quotation_id = target_quotation_id;
  current_pricing := public.calculate_catalog_price(quotation_record.organization_id, item_ids, quotation_record.prescription_revision_id, quotation_record.usd_to_cup_rate);
  select jsonb_agg(jsonb_build_object('kind', value->>'kind', 'itemId', (value->>'itemId')::bigint, 'code', coalesce(value->>'code', value->>'ruleCode'), 'name', value->>'name', 'category', value->>'category', 'amount', (value->>'amount')::numeric, 'currency', value->>'currency'))
  into current_lines from jsonb_array_elements(current_pricing->'lineItems');
  if snapshot_lines is distinct from current_lines or quotation_record.totals is distinct from current_pricing->'totals' then
    raise exception using errcode = '40001', message = 'Los precios cambiaron. Actualiza la cotización y confirma nuevamente.';
  end if;
  new_order_number := private.next_order_number(quotation_record.organization_id);
  insert into public.orders (order_number, organization_id, branch_id, customer_id, prescription_revision_id, quotation_id, primary_seller_id, usd_to_cup_rate, totals, cup_equivalent)
  values (new_order_number, quotation_record.organization_id, quotation_record.branch_id, quotation_record.customer_id, quotation_record.prescription_revision_id, quotation_record.id, quotation_record.seller_id, quotation_record.usd_to_cup_rate, quotation_record.totals, quotation_record.cup_equivalent)
  returning id into new_order_id;
  insert into public.order_items (order_id, organization_id, branch_id, catalog_item_id, line_kind, source_code, category, name, amount, currency, position)
  select new_order_id, organization_id, branch_id, catalog_item_id, line_kind, source_code, category, name, amount, currency, position from public.quotation_items where quotation_id = quotation_record.id order by position;
  insert into public.order_confirmations (order_id, organization_id, branch_id, confirmed_by, totals, usd_to_cup_rate, cup_equivalent)
  values (new_order_id, quotation_record.organization_id, quotation_record.branch_id, (select auth.uid()), quotation_record.totals, quotation_record.usd_to_cup_rate, quotation_record.cup_equivalent);
  update public.quotations set status = 'accepted', accepted_at = now() where id = quotation_record.id;
  return jsonb_build_object('orderId', new_order_id, 'orderNumber', new_order_number);
end;
$$;

revoke all on function public.save_quotation(bigint, bigint, bigint, bigint, bigint, bigint[], numeric, text), public.accept_quotation(bigint) from public, anon;
grant execute on function public.save_quotation(bigint, bigint, bigint, bigint, bigint, bigint[], numeric, text), public.accept_quotation(bigint) to authenticated;
