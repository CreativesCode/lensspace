-- Transactional grace period and subscription notices fixture. pg_net requests are
-- only sent on commit, so the rollback keeps this test from sending WhatsApp.
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('32000000-0000-0000-0000-000000000001', 'grace-admin@example.test', '{"display_name":"Platform Admin"}', now()),
  ('32000000-0000-0000-0000-000000000002', 'grace-owner@example.test', '{"display_name":"Owner"}', now());
insert into private.platform_admins (user_id, created_by)
values ('32000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001');
update public.profiles set phone = '+5350000000' where user_id = '32000000-0000-0000-0000-000000000002';

-- Expiry offsets from today: +3 (no notice), +2, 0, -3 (grace), -5 (last grace day), -6 (block).
insert into public.organizations (id, name, order_prefix) overriding system value values
  (997000001, 'Far Optics', 'FAR'), (997000002, 'Soon Optics', 'SOO'), (997000003, 'Due Optics', 'DUE'),
  (997000004, 'Grace Optics', 'GRA'), (997000005, 'Last Optics', 'LAS'), (997000006, 'Block Optics', 'BLO');
insert into public.organization_memberships (organization_id, user_id, role, status)
select id, '32000000-0000-0000-0000-000000000002', 'owner', 'active' from public.organizations where id between 997000001 and 997000006;
insert into public.subscriptions (organization_id, status, amount, currency, billing_period, starts_on, expires_on) values
  (997000001, 'active', 10, 'USD', 'monthly', current_date - 30, current_date + 3),
  (997000002, 'trial', 0, 'USD', 'monthly', current_date - 10, current_date + 2),
  (997000003, 'active', 10, 'USD', 'monthly', current_date - 30, current_date),
  (997000004, 'active', 10, 'USD', 'monthly', current_date - 30, current_date - 3),
  (997000005, 'trial', 0, 'USD', 'monthly', current_date - 30, current_date - 5),
  (997000006, 'active', 10, 'USD', 'monthly', current_date - 30, current_date - 6);
insert into public.license_contracts (organization_id, status, plan, module_keys, monthly_amount, starts_on, client_legal_name, signed_file_path, signed_at)
values (997000004, 'signed', 'basic', array['optical_sales'], 10, current_date - 30, 'Grace Optics', '997000004/1/firmado.pdf', now());

-- The owner still operates on the last grace day and is blocked the day after.
set local role authenticated;
select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-000000000002', true);
do $$
begin
  if not private.can_operate_in_organization(997000005) then raise exception 'Blocked on the last grace day'; end if;
  if private.can_operate_in_organization(997000006) then raise exception 'Not blocked the day after the grace period'; end if;
end $$;
reset role;

do $$
declare queued integer;
begin
  queued := private.run_subscription_notices();
  if exists (select 1 from private.subscription_notices where organization_id = 997000001) then raise exception 'Notice sent too early'; end if;
  if not exists (select 1 from private.subscription_notices where organization_id = 997000002 and kind = 'owner_reminder' and recipient = '+5350000000') then
    raise exception 'Missing reminder two days before';
  end if;
  if (select count(*) from private.subscription_notices where organization_id = 997000003 and kind in ('owner_due', 'admin_due')) <> 2 then
    raise exception 'Expiry day must notify owner and admin';
  end if;
  if not exists (select 1 from private.subscription_notices where organization_id = 997000004 and kind = 'owner_grace' and message like '%Quedan 3 día(s)%') then
    raise exception 'Wrong grace reminder';
  end if;
  if not exists (select 1 from private.subscription_notices where organization_id = 997000005 and kind = 'owner_grace' and message like '%Quedan 1 día(s)%') then
    raise exception 'Missing last grace day reminder';
  end if;
  if (select count(*) from private.subscription_notices where organization_id = 997000006 and kind in ('owner_blocked', 'admin_blocked')) <> 2 then
    raise exception 'Block day must notify owner and admin';
  end if;
  if (select status from public.subscriptions where organization_id = 997000006) <> 'expired' then raise exception 'Blocked subscription not marked expired'; end if;

  -- A rerun the same day sends nothing new.
  perform private.run_subscription_notices();
  if (select count(*) from private.subscription_notices where organization_id between 997000001 and 997000006) <> queued then
    raise exception 'Rerun duplicated notices';
  end if;
end $$;

-- Paying inside the grace period continues from the day after the expiry.
set local role authenticated;
select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-000000000001', true);
do $$
declare result jsonb;
begin
  result := public.record_subscription_payment(997000004, 'Pago en el margen');
  if (result ->> 'expiresOn')::date <> (current_date - 2 + interval '1 month' - interval '1 day')::date then
    raise exception 'Grace payment did not continue the period %', result;
  end if;
end $$;

rollback;
