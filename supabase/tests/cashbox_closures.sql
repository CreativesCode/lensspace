-- Transactional cashbox fixture. Run against a disposable database after migrations.
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('10000000-0000-0000-0000-000000000001', 'seller@example.test', '{"display_name":"Seller One"}', now()),
  ('10000000-0000-0000-0000-000000000002', 'seller2@example.test', '{"display_name":"Seller Two"}', now()),
  ('10000000-0000-0000-0000-000000000003', 'owner@example.test', '{"display_name":"Owner"}', now());

insert into public.organizations (id, name, order_prefix, timezone) overriding system value values (910000001, 'Cashbox Test', 'CBTQA', 'America/Havana');
insert into public.branches (id, organization_id, name, code) overriding system value values (910000001, 910000001, 'Main', 'MAIN');
insert into public.organization_memberships (organization_id, user_id, branch_id, role, status) values
  (910000001, '10000000-0000-0000-0000-000000000001', 910000001, 'seller', 'active'),
  (910000001, '10000000-0000-0000-0000-000000000002', 910000001, 'seller', 'active'),
  (910000001, '10000000-0000-0000-0000-000000000003', null, 'owner', 'active');
insert into public.subscriptions (organization_id, status, starts_on, expires_on)
values (910000001, 'active', current_date - 1, current_date + 1);
insert into public.organization_modules (organization_id, module_key, changed_by) values
  (910000001, 'optical_sales', '10000000-0000-0000-0000-000000000003'),
  (910000001, 'cashbox', '10000000-0000-0000-0000-000000000003');
insert into public.customers (id, organization_id, branch_id, full_name, created_by) overriding system value
values (910000001, 910000001, 910000001, 'Cashbox Customer', '10000000-0000-0000-0000-000000000001');
insert into public.quotations (id, organization_id, branch_id, customer_id, seller_id, status, usd_to_cup_rate, totals, cup_equivalent) overriding system value
values (910000001, 910000001, 910000001, 910000001, '10000000-0000-0000-0000-000000000001', 'accepted', 400, '{}', 1000);
insert into public.orders (id, order_number, organization_id, branch_id, customer_id, quotation_id, primary_seller_id, usd_to_cup_rate, totals, cup_equivalent) overriding system value
values (910000001, 'CBTQA-2091-000001', 910000001, 910000001, 910000001, 910000001, '10000000-0000-0000-0000-000000000001', 400, '{}', 1000);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select public.register_cash_payment(910000001, 400, 'CUP', 1, 'before close');

do $$
declare result jsonb;
begin
  select public.close_cashbox(id, 'primary', 390) into result from public.seller_cashboxes limit 1;
  if (result ->> 'expectedAmount')::numeric <> 400 or (result ->> 'differenceAmount')::numeric <> -10 then
    raise exception 'Primary closure totals are incorrect: %', result;
  end if;
end;
$$;

select public.register_cash_payment(910000001, 100, 'CUP', 1, 'after close');

do $$
declare result jsonb;
begin
  if not exists (select 1 from public.payments where amount = 100 and is_post_close) then
    raise exception 'Late payment was not marked post-close';
  end if;
  select public.close_cashbox(id, 'complementary', 100) into result from public.seller_cashboxes limit 1;
  if (result ->> 'sequenceNumber')::integer <> 1 or (result ->> 'expectedAmount')::numeric <> 100 then
    raise exception 'Complementary closure is incorrect: %', result;
  end if;
  if (select count(*) from public.cashbox_closure_payments) <> 2 then
    raise exception 'Payments were not allocated exactly once';
  end if;
  if (select sum(expected_amount) from public.cashbox_closures) <> 500 then
    raise exception 'Consolidated expected amount is incorrect';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$ begin
  if exists (select 1 from public.seller_cashboxes) then
    raise exception 'Unrelated seller can read another seller cashbox';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
do $$ begin
  if (select count(*) from public.seller_cashboxes) <> 1 then
    raise exception 'Owner cannot review organization cashboxes';
  end if;
end $$;

reset role;
do $$ begin
  begin
    update public.cashbox_closures set declared_amount = declared_amount + 1;
    raise exception 'Closure update unexpectedly succeeded';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.cashbox_closure_payments;
    raise exception 'Allocation delete unexpectedly succeeded';
  exception when sqlstate '55000' then null;
  end;
end $$;

rollback;
