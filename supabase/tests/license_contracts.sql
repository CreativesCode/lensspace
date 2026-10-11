-- Transactional license contracts fixture (prp-license-pricing-and-contracts.md).
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('28000000-0000-0000-0000-000000000001', 'license-admin@example.test', '{"display_name":"Platform Admin"}', now()),
  ('28000000-0000-0000-0000-000000000002', 'license-owner@example.test', '{"display_name":"Owner"}', now());
insert into private.platform_admins (user_id, created_by)
values ('28000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001');
insert into public.organizations (id, name, order_prefix) overriding system value values
  (980000001, 'Founder Optics', 'FOU'), (980000002, 'Referred Optics', 'REF'), (980000003, 'Second Referred', 'SEC');
insert into public.organization_memberships (organization_id, user_id, role, status)
values (980000001, '28000000-0000-0000-0000-000000000002', 'owner', 'active');
insert into public.subscriptions (organization_id, status, amount, currency, billing_period, starts_on, expires_on) values
  (980000001, 'active', 0, 'USD', 'monthly', current_date, current_date + 30),
  (980000002, 'trial', 0, 'USD', 'monthly', current_date, current_date + 15),
  (980000003, 'trial', 0, 'USD', 'monthly', current_date, current_date + 15);
insert into storage.objects (bucket_id, name, owner_id) values
  ('license-contracts', '980000001/980000001/firmado.pdf', '28000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000001', true);

insert into public.license_contracts (
  organization_id, plan, module_keys, monthly_amount, billing_period, starts_on, term_months,
  price_locked_until, post_lock_monthly_amount, client_legal_name
) values (
  980000001, 'founder', array['optical_sales', 'cashbox', 'production', 'whatsapp', 'analytics'], 15, 'annual',
  current_date, 24, current_date + 729, 19, 'Founder Optics'
);

do $$
declare founder public.license_contracts%rowtype; credit jsonb;
begin
  select * into founder from public.license_contracts where organization_id = 980000001;
  if founder.period_amount <> 150 then raise exception 'Annual period should charge 10 months, got %', founder.period_amount; end if;
  if founder.ends_on <> (current_date + interval '24 months' - interval '1 day')::date then raise exception 'Wrong end date %', founder.ends_on; end if;

  -- Contract ids are generated; re-point the fixture file to the real path.
  perform set_config('role', 'postgres', true);
  update storage.objects set name = '980000001/' || founder.id || '/firmado.pdf' where name = '980000001/980000001/firmado.pdf';
  perform set_config('role', 'authenticated', true);
  perform public.sign_license_contract(founder.id, '980000001/' || founder.id || '/firmado.pdf');
  if (select amount from public.subscriptions where organization_id = 980000001) <> 150 then
    raise exception 'Signing did not sync the subscription amount';
  end if;

  begin
    update public.license_contracts set monthly_amount = 1 where id = founder.id;
    if found then raise exception 'A signed contract was edited'; end if;
  end;

  -- Referred store: no credit until it pays its first period.
  insert into public.license_contracts (organization_id, plan, module_keys, monthly_amount, starts_on, client_legal_name, referred_by_organization_id)
  values (980000002, 'basic', array['optical_sales', 'whatsapp'], 10, current_date, 'Referred Optics', 980000001);
end $$;

do $$
declare referred_id bigint; credit jsonb; failed boolean := false;
begin
  select id into referred_id from public.license_contracts where organization_id = 980000002;
  perform set_config('role', 'postgres', true);
  insert into storage.objects (bucket_id, name, owner_id) values
    ('license-contracts', '980000002/' || referred_id || '/firmado.pdf', '28000000-0000-0000-0000-000000000001');
  perform set_config('role', 'authenticated', true);
  perform public.sign_license_contract(referred_id, '980000002/' || referred_id || '/firmado.pdf');
  begin
    perform public.apply_referral_credit(referred_id);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'Credit applied before the first payment'; end if;

  perform set_config('role', 'postgres', true);
  update public.subscriptions set status = 'active', last_renewed_on = current_date where organization_id = 980000002;
  perform set_config('role', 'authenticated', true);
  credit := public.apply_referral_credit(referred_id);
  if (credit ->> 'days')::int <> 15 then raise exception 'Founder referrer should get 15 days, got %', credit; end if;
  if (select expires_on from public.subscriptions where organization_id = 980000001) <> current_date + 45 then
    raise exception 'Founder expiry was not extended';
  end if;

  failed := false;
  begin
    perform public.apply_referral_credit(referred_id);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'Credit applied twice'; end if;
end $$;

-- A non-founder referrer gets 10 days.
do $$
declare referred_id bigint; credit jsonb;
begin
  insert into public.license_contracts (organization_id, plan, module_keys, monthly_amount, starts_on, client_legal_name, referred_by_organization_id)
  values (980000003, 'basic', array['optical_sales', 'whatsapp'], 10, current_date, 'Second Referred', 980000002)
  returning id into referred_id;
  perform set_config('role', 'postgres', true);
  insert into storage.objects (bucket_id, name, owner_id) values
    ('license-contracts', '980000003/' || referred_id || '/firmado.pdf', '28000000-0000-0000-0000-000000000001');
  update public.subscriptions set status = 'active', last_renewed_on = current_date where organization_id = 980000003;
  perform set_config('role', 'authenticated', true);
  perform public.sign_license_contract(referred_id, '980000003/' || referred_id || '/firmado.pdf');
  credit := public.apply_referral_credit(referred_id);
  if (credit ->> 'days')::int <> 10 then raise exception 'Regular referrer should get 10 days, got %', credit; end if;
end $$;

-- Tenants never read contracts.
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000002', true);
do $$
begin
  if exists (select 1 from public.license_contracts) or exists (select 1 from public.platform_provider_profile) then
    raise exception 'Owner can read license data';
  end if;
end $$;

rollback;
