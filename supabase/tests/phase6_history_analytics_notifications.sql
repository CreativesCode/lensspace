-- Transactional Phase 6 fixture. Run after all migrations.
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('26000000-0000-0000-0000-000000000001', 'phase6-seller@example.test', '{"display_name":"Seller"}', now()),
  ('26000000-0000-0000-0000-000000000002', 'phase6-owner@example.test', '{"display_name":"Owner"}', now()),
  ('26000000-0000-0000-0000-000000000003', 'phase6-other@example.test', '{"display_name":"Other"}', now());
insert into public.organizations (id, name, order_prefix, timezone) overriding system value
values (960000001, 'Phase Six Test', 'PHSQA', 'America/Havana');
insert into public.branches (id, organization_id, name, code) overriding system value
values (960000001, 960000001, 'Main', 'MAIN');
insert into public.organization_memberships (organization_id, user_id, branch_id, role, status) values
  (960000001, '26000000-0000-0000-0000-000000000001', 960000001, 'seller', 'active'),
  (960000001, '26000000-0000-0000-0000-000000000002', null, 'owner', 'active');
insert into public.subscriptions (organization_id, status, starts_on, expires_on)
values (960000001, 'active', current_date - 1, current_date + 1);
insert into public.organization_modules (organization_id, module_key, changed_by) values
  (960000001, 'optical_sales', '26000000-0000-0000-0000-000000000002'),
  (960000001, 'cashbox', '26000000-0000-0000-0000-000000000002'),
  (960000001, 'whatsapp', '26000000-0000-0000-0000-000000000002'),
  (960000001, 'analytics', '26000000-0000-0000-0000-000000000002');
insert into public.customers (id, organization_id, branch_id, full_name, messaging_consent, created_by) overriding system value
values (960000001, 960000001, 960000001, 'Phase Customer', true, '26000000-0000-0000-0000-000000000001');
insert into public.customer_phones (id, organization_id, branch_id, customer_id, phone_number, is_primary) overriding system value
values (960000001, 960000001, 960000001, 960000001, '+53 5555 0101', true);
insert into public.quotations (id, organization_id, branch_id, customer_id, seller_id, status, usd_to_cup_rate, totals, cup_equivalent) overriding system value
values (960000001, 960000001, 960000001, 960000001, '26000000-0000-0000-0000-000000000001', 'accepted', 400, '{}', 1000);
insert into public.orders (id, order_number, organization_id, branch_id, customer_id, quotation_id, primary_seller_id, usd_to_cup_rate, totals, cup_equivalent) overriding system value
values (960000001, 'PHSQA-2096-000001', 960000001, 960000001, 960000001, 960000001, '26000000-0000-0000-0000-000000000001', 400, '{}', 1000);
insert into public.order_confirmations (order_id, organization_id, branch_id, confirmed_by, totals, usd_to_cup_rate, cup_equivalent)
values (960000001, 960000001, 960000001, '26000000-0000-0000-0000-000000000001', '{}', 400, 1000);

set local role authenticated;
select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000001', true);
select public.register_cash_payment(960000001, 250, 'CUP', 1, 'Phase 6 fixture');

reset role;
do $$
begin
  if not exists (
    select 1 from private.notification_dispatches
    where source_event_key = 'order_accepted:960000001'
      and template_key = 'order_accepted'
  ) or not exists (
    select 1 from private.notification_dispatches
    where source_event_key like 'payment_received:%'
      and order_id = 960000001
      and template_key = 'payment_received'
  ) then
    raise exception 'Automatic WhatsApp dispatches were not queued for order acceptance and payment';
  end if;
end $$;
set local role authenticated;

do $$
declare
  prepared jsonb;
  openwa_prepared jsonb;
begin
  prepared := public.prepare_manual_notification(960000001, 'payment_received');
  if prepared ->> 'outcome' <> 'opened' or prepared ->> 'recipient' <> '5355550101' then
    raise exception 'Manual notification boundary did not preserve the recipient';
  end if;
  if jsonb_array_length(public.get_order_timeline(960000001)) < 4 then
    raise exception 'Unified timeline omitted expected immutable events';
  end if;

  openwa_prepared := public.prepare_openwa_notification(960000001, 'payment_received');
  if openwa_prepared ->> 'recipient' <> '5355550101'
    or openwa_prepared ->> 'actorId' <> '26000000-0000-0000-0000-000000000001'
    or openwa_prepared ->> 'failureCode' is not null then
    raise exception 'OpenWA notification payload did not preserve authorization or recipient: %', openwa_prepared;
  end if;
end $$;

select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000003', true);
do $$ begin
  begin
    perform public.get_order_timeline(960000001);
    raise exception 'Unrelated user unexpectedly read the timeline';
  exception when no_data_found then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000002', true);
do $$
declare metrics jsonb;
begin
  metrics := public.get_owner_dashboard(960000001, null, null, current_date - 1, current_date + 1);
  if (metrics ->> 'salesCup')::numeric <> 1000
    or (metrics ->> 'collectionsCup')::numeric <> 250
    or (metrics ->> 'outstandingCup')::numeric <> 750 then
    raise exception 'Owner metrics do not match fixture totals: %', metrics;
  end if;
end $$;

reset role;
do $$ begin
  begin
    update public.notification_attempts set outcome = 'failed';
    raise exception 'Immutable notification attempt update unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
end $$;

rollback;
