-- Transactional fixture: organizations in preparation and payments that charge the
-- grace days used. pg_net only sends on commit, so the rollback sends no WhatsApp.
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('33000000-0000-0000-0000-000000000001', 'pending-admin@example.test', '{"display_name":"Platform Admin"}', now()),
  ('33000000-0000-0000-0000-000000000002', 'pending-owner@example.test', '{"display_name":"Owner"}', now());
insert into private.platform_admins (user_id, created_by)
values ('33000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001');

-- 1 pending, 2 in grace (expired 3 days ago), 3 blocked (expired 15 days ago), 4 trial running (10 days left).
insert into public.organizations (id, name, order_prefix) overriding system value values
  (996000001, 'Pending Optics', 'PEN'), (996000002, 'Grace Optics', 'GRC'),
  (996000003, 'Blocked Optics', 'BLK'), (996000004, 'Trial Optics', 'TRI');
insert into public.organization_memberships (organization_id, user_id, role, status)
select id, '33000000-0000-0000-0000-000000000002', 'owner', 'active' from public.organizations where id between 996000001 and 996000004;
insert into public.subscriptions (organization_id, status, amount, currency, billing_period, starts_on, expires_on) values
  (996000001, 'pending', 15, 'USD', 'monthly', current_date - 2, current_date - 2),
  (996000002, 'active', 10, 'USD', 'monthly', current_date - 33, current_date - 3),
  (996000003, 'expired', 10, 'USD', 'monthly', current_date - 45, current_date - 15),
  (996000004, 'trial', 0, 'USD', 'monthly', current_date - 5, current_date + 10);
insert into public.license_contracts (organization_id, status, plan, module_keys, monthly_amount, starts_on, client_legal_name, signed_file_path, signed_at)
select id, 'signed', 'basic', array['optical_sales'], 10, current_date, name, id || '/1/firmado.pdf', now()
from public.organizations where id between 996000001 and 996000004;

do $$
begin
  if (select amount from public.subscriptions where organization_id = 996000001) <> 0 then raise exception 'Pending must be free'; end if;
  perform private.run_subscription_notices();
  if exists (select 1 from private.subscription_notices where organization_id = 996000001) then raise exception 'Pending got a notice'; end if;
  begin
    update public.subscriptions set status = 'trial' where organization_id = 996000001;
    raise exception 'Pending moved into trial';
  exception when sqlstate '55000' then null;
  end;
  begin
    update public.subscriptions set status = 'pending' where organization_id = 996000003;
    raise exception 'Moved back into pending';
  exception when sqlstate '55000' then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-000000000002', true);
do $$
begin
  if private.can_operate_in_organization(996000001) then raise exception 'Pending can operate'; end if;
  if not exists (select 1 from jsonb_array_elements(public.get_my_subscription_notices()) notice
    where (notice ->> 'organizationId')::bigint = 996000001 and (notice ->> 'isPending')::boolean) then
    raise exception 'Banner does not flag pending';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-000000000001', true);
do $$
declare result jsonb;
begin
  result := public.record_subscription_payment(996000001, 'Primer pago');
  if (result ->> 'coveredFrom')::date <> current_date then raise exception 'Pending first payment must start today: %', result; end if;
  result := public.record_subscription_payment(996000002, 'Pago en el margen');
  if (result ->> 'coveredFrom')::date <> current_date - 2 then raise exception 'Grace payment must continue the period: %', result; end if;
  result := public.record_subscription_payment(996000003, 'Pago tras el bloqueo');
  if (result ->> 'coveredFrom')::date <> current_date - 5 then raise exception 'Blocked payment must charge the grace days: %', result; end if;
  result := public.record_subscription_payment(996000004, 'Pago durante la prueba');
  if (result ->> 'coveredFrom')::date <> current_date + 11 then raise exception 'Trial payment must start after the trial: %', result; end if;
end $$;

select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-000000000002', true);
do $$
begin
  if not private.can_operate_in_organization(996000001) then raise exception 'Paid pending cannot operate'; end if;
  if not private.can_operate_in_organization(996000003) then raise exception 'Paid blocked cannot operate'; end if;
end $$;

rollback;
