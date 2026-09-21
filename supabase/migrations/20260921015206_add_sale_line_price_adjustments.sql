alter table public.quotation_items
  add column base_amount numeric(14,2),
  add column price_adjustment_reason text,
  add column price_adjusted_by uuid references auth.users(id),
  add column discount_authorized_by uuid references auth.users(id);

update public.quotation_items set base_amount = amount where base_amount is null;
alter table public.quotation_items alter column base_amount set not null;
alter table public.quotation_items
  add constraint quotation_items_base_amount_nonnegative check (base_amount >= 0),
  add constraint quotation_items_adjustment_reason_length check (
    price_adjustment_reason is null or char_length(price_adjustment_reason) between 5 and 300
  );

alter table public.order_items
  add column base_amount numeric(14,2),
  add column price_adjustment_reason text,
  add column price_adjusted_by uuid references auth.users(id),
  add column discount_authorized_by uuid references auth.users(id);

alter table public.order_items disable trigger order_items_immutable;
update public.order_items set base_amount = amount where base_amount is null;
alter table public.order_items enable trigger order_items_immutable;
alter table public.order_items alter column base_amount set not null;
alter table public.order_items
  add constraint order_items_base_amount_nonnegative check (base_amount >= 0),
  add constraint order_items_adjustment_reason_length check (
    price_adjustment_reason is null or char_length(price_adjustment_reason) between 5 and 300
  );

create or replace function public.calculate_sale_price(
  target_organization_id bigint,
  selected_item_ids bigint[],
  target_prescription_revision_id bigint,
  usd_to_cup_rate numeric,
  line_adjustments jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  pricing jsonb;
  line jsonb;
  adjustment jsonb;
  adjusted_lines jsonb := '[]'::jsonb;
  totals jsonb := '{}'::jsonb;
  base_amount numeric(14,2);
  agreed_amount numeric(14,2);
  current_total numeric(14,2);
  reason text;
  actor_is_owner boolean;
  authorization_actor uuid;
  cup_equivalent numeric(14,2);
begin
  if line_adjustments is null or jsonb_typeof(line_adjustments) <> 'object' then
    raise exception using errcode = '22023', message = 'Los ajustes de precio no tienen un formato válido.';
  end if;

  pricing := public.calculate_catalog_price(
    target_organization_id,
    selected_item_ids,
    target_prescription_revision_id,
    usd_to_cup_rate
  );
  actor_is_owner := private.is_platform_admin()
    or private.has_organization_role(target_organization_id, array['owner']);

  for line in select value from jsonb_array_elements(pricing->'lineItems') loop
    base_amount := (line->>'amount')::numeric;
    agreed_amount := base_amount;
    reason := null;
    authorization_actor := null;

    if line->>'kind' = 'catalog_item' then
      adjustment := line_adjustments -> (line->>'itemId');
      if adjustment is not null then
        begin
          agreed_amount := (adjustment->>'amount')::numeric;
        exception when others then
          raise exception using errcode = '22023', message = 'El precio acordado debe ser un número válido.';
        end;
        reason := nullif(trim(adjustment->>'reason'), '');
      end if;

      if agreed_amount < 0 then
        raise exception using errcode = '22023', message = 'El precio acordado no puede ser negativo.';
      end if;
      if agreed_amount <> base_amount and (reason is null or char_length(reason) not between 5 and 300) then
        raise exception using errcode = '22023', message = 'Explica el ajuste de precio en al menos 5 caracteres.';
      end if;
      if agreed_amount < base_amount * 0.90 and not actor_is_owner then
        raise exception using errcode = '42501', message = 'Un descuento mayor del 10 % requiere autorización del propietario.';
      end if;
      if agreed_amount < base_amount * 0.90 then
        authorization_actor := (select auth.uid());
      end if;

      line := line || jsonb_build_object(
        'baseAmount', base_amount,
        'amount', agreed_amount,
        'adjustmentReason', reason,
        'adjustedBy', case when agreed_amount <> base_amount then (select auth.uid()) else null end,
        'discountAuthorizedBy', authorization_actor
      );
    else
      line := line || jsonb_build_object('baseAmount', base_amount);
    end if;

    adjusted_lines := adjusted_lines || jsonb_build_array(line);
    current_total := coalesce((totals ->> (line->>'currency'))::numeric, 0) + agreed_amount;
    totals := jsonb_set(totals, array[line->>'currency'], to_jsonb(current_total), true);
  end loop;

  if usd_to_cup_rate is not null then
    cup_equivalent := coalesce((totals ->> 'CUP')::numeric, 0)
      + coalesce((totals ->> 'USD')::numeric, 0) * usd_to_cup_rate;
  end if;

  return pricing || jsonb_build_object(
    'lineItems', adjusted_lines,
    'totals', totals,
    'cupEquivalent', cup_equivalent
  );
end;
$$;

revoke all on function public.calculate_sale_price(bigint, bigint[], bigint, numeric, jsonb) from public, anon;
grant execute on function public.calculate_sale_price(bigint, bigint[], bigint, numeric, jsonb) to authenticated;

drop function public.save_quotation(bigint, bigint, bigint, bigint, bigint, bigint[], numeric, text);

create function public.save_quotation(
  target_quotation_id bigint,
  target_organization_id bigint,
  target_branch_id bigint,
  target_customer_id bigint,
  target_prescription_revision_id bigint,
  selected_item_ids bigint[],
  target_usd_to_cup_rate numeric,
  target_notes text default null,
  target_line_adjustments jsonb default '{}'::jsonb
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
  pricing := public.calculate_sale_price(target_organization_id, selected_item_ids, target_prescription_revision_id, target_usd_to_cup_rate, target_line_adjustments);
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
    insert into public.quotation_items (
      quotation_id, organization_id, branch_id, catalog_item_id, line_kind, source_code, category,
      name, base_amount, amount, currency, position, price_adjustment_reason, price_adjusted_by, discount_authorized_by
    ) values (
      quote_id, target_organization_id, target_branch_id, (line->>'itemId')::bigint, line->>'kind',
      coalesce(line->>'code', line->>'ruleCode'), line->>'category', line->>'name',
      (line->>'baseAmount')::numeric, (line->>'amount')::numeric, line->>'currency', line_position,
      line->>'adjustmentReason', (line->>'adjustedBy')::uuid, (line->>'discountAuthorizedBy')::uuid
    );
  end loop;
  return quote_id;
end;
$$;

create or replace function public.accept_quotation(target_quotation_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
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

revoke all on function public.save_quotation(bigint, bigint, bigint, bigint, bigint, bigint[], numeric, text, jsonb) from public, anon;
grant execute on function public.save_quotation(bigint, bigint, bigint, bigint, bigint, bigint[], numeric, text, jsonb) to authenticated;
