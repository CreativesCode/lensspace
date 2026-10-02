-- QA-15 / QA-03 follow-up: saving a quotation took two round trips (price, then save)
-- and a retry after a lost response created a second, orphan quotation.
-- save_sale_quotation saves and returns the pricing in one call, and reuses the
-- quotation created by an earlier attempt with the same request id.

alter table public.quotations add column client_request_id uuid;

create unique index quotations_seller_client_request_key
  on public.quotations (seller_id, client_request_id)
  where client_request_id is not null;

grant update (client_request_id) on public.quotations to authenticated;

create function public.save_sale_quotation(
  target_quotation_id bigint,
  target_organization_id bigint,
  target_branch_id bigint,
  target_customer_id bigint,
  target_prescription_revision_id bigint,
  selected_item_ids bigint[],
  target_usd_to_cup_rate numeric,
  target_notes text default null,
  target_line_adjustments jsonb default '{}'::jsonb,
  quotation_request_id uuid default null
) returns jsonb language plpgsql set search_path = '' as $$
declare
  quote_id bigint := target_quotation_id;
  reused boolean := false;
  pricing jsonb;
begin
  if quote_id is null and quotation_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(quotation_request_id::text, 0));
    select quotation.id into quote_id
    from public.quotations quotation
    where quotation.seller_id = (select auth.uid()) and quotation.client_request_id = quotation_request_id;
    reused := found;
  end if;

  pricing := public.calculate_sale_price(
    target_organization_id, selected_item_ids, target_prescription_revision_id,
    target_usd_to_cup_rate, target_line_adjustments
  );

  -- A retry carries the same content: return the quotation of the earlier attempt
  -- (pending or already accepted) instead of saving a second one.
  if not reused then
    quote_id := public.save_quotation(
      quote_id, target_organization_id, target_branch_id, target_customer_id,
      target_prescription_revision_id, selected_item_ids, target_usd_to_cup_rate,
      target_notes, target_line_adjustments
    );
    if quotation_request_id is not null then
      update public.quotations set client_request_id = quotation_request_id
      where id = quote_id and client_request_id is null;
    end if;
  end if;

  return jsonb_build_object('quotationId', quote_id, 'pricing', pricing);
end;
$$;

revoke all on function public.save_sale_quotation(bigint, bigint, bigint, bigint, bigint, bigint[], numeric, text, jsonb, uuid) from public, anon;
grant execute on function public.save_sale_quotation(bigint, bigint, bigint, bigint, bigint, bigint[], numeric, text, jsonb, uuid) to authenticated, service_role;
