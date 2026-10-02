-- QA-04 follow-up: the quotations UPDATE policy (status <> 'accepted') hides an
-- accepted quotation from SELECT ... FOR UPDATE, so the previous early return never
-- ran. Look the existing order up right before reporting the quotation as missing.

create or replace function public.accept_quotation(target_quotation_id bigint)
returns jsonb language plpgsql set search_path = '' as $$
declare
  quotation_record public.quotations%rowtype;
  current_pricing jsonb;
  snapshot_base_lines jsonb;
  current_base_lines jsonb;
  item_ids bigint[];
  new_order_id bigint;
  new_order_number text;
begin
  select * into quotation_record from public.quotations where id = target_quotation_id for update;
  if not found or quotation_record.status <> 'awaiting_acceptance' then
    -- Already accepted (the UPDATE policy hides accepted rows from FOR UPDATE): a
    -- retry after a lost response or a concurrent click returns the existing order.
    select sale_order.id, sale_order.order_number into new_order_id, new_order_number
    from public.orders sale_order
    join public.quotations quotation on quotation.id = sale_order.quotation_id
    where sale_order.quotation_id = target_quotation_id
      and private.can_write_seller_sale(quotation.organization_id, quotation.branch_id, quotation.seller_id);
    if found then
      return jsonb_build_object('orderId', new_order_id, 'orderNumber', new_order_number, 'alreadyAccepted', true);
    end if;
    raise exception using errcode = 'P0002', message = 'Cotización pendiente no encontrada.';
  end if;
  if not private.can_write_seller_sale(quotation_record.organization_id, quotation_record.branch_id, quotation_record.seller_id) then
    raise exception using errcode = '42501', message = 'No puedes aceptar esta cotización.';
  end if;
  select array_agg(catalog_item_id order by position) filter (where catalog_item_id is not null),
    jsonb_agg(jsonb_build_object('kind', line_kind, 'itemId', catalog_item_id, 'code', source_code, 'name', name, 'category', category, 'amount', base_amount, 'currency', currency) order by position)
  into item_ids, snapshot_base_lines from public.quotation_items where quotation_id = target_quotation_id;
  current_pricing := public.calculate_catalog_price(quotation_record.organization_id, item_ids, quotation_record.prescription_revision_id, quotation_record.usd_to_cup_rate);
  select jsonb_agg(jsonb_build_object('kind', value->>'kind', 'itemId', (value->>'itemId')::bigint, 'code', coalesce(value->>'code', value->>'ruleCode'), 'name', value->>'name', 'category', value->>'category', 'amount', (value->>'amount')::numeric, 'currency', value->>'currency'))
  into current_base_lines from jsonb_array_elements(current_pricing->'lineItems');
  if snapshot_base_lines is distinct from current_base_lines then
    raise exception using errcode = '40001', message = 'Los precios base cambiaron. Actualiza la cotización y confirma nuevamente.';
  end if;
  new_order_number := private.next_order_number(quotation_record.organization_id);
  insert into public.orders (order_number, organization_id, branch_id, customer_id, prescription_revision_id, quotation_id, primary_seller_id, usd_to_cup_rate, totals, cup_equivalent)
  values (new_order_number, quotation_record.organization_id, quotation_record.branch_id, quotation_record.customer_id, quotation_record.prescription_revision_id, quotation_record.id, quotation_record.seller_id, quotation_record.usd_to_cup_rate, quotation_record.totals, quotation_record.cup_equivalent)
  returning id into new_order_id;
  insert into public.order_items (order_id, organization_id, branch_id, catalog_item_id, line_kind, source_code, category, name, base_amount, amount, currency, position, price_adjustment_reason, price_adjusted_by, discount_authorized_by)
  select new_order_id, organization_id, branch_id, catalog_item_id, line_kind, source_code, category, name, base_amount, amount, currency, position, price_adjustment_reason, price_adjusted_by, discount_authorized_by
  from public.quotation_items where quotation_id = quotation_record.id order by position;
  insert into public.order_confirmations (order_id, organization_id, branch_id, confirmed_by, totals, usd_to_cup_rate, cup_equivalent)
  values (new_order_id, quotation_record.organization_id, quotation_record.branch_id, (select auth.uid()), quotation_record.totals, quotation_record.usd_to_cup_rate, quotation_record.cup_equivalent);
  update public.quotations set status = 'accepted', accepted_at = now() where id = quotation_record.id;
  return jsonb_build_object('orderId', new_order_id, 'orderNumber', new_order_number);
end;
$$;
