-- Transactional trial vs paid subscription fixture.
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('30000000-0000-0000-0000-000000000001', 'billing-admin@example.test', '{"display_name":"Platform Admin"}', now());
insert into private.platform_admins (user_id, created_by)
values ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');
insert into public.organizations (id, name, order_prefix) overriding system value values
  (995000001, 'Trial Optics', 'TRI'), (995000002, 'Founder Late', 'FOL');
insert into public.subscriptions (organization_id, status, amount, currency, billing_period, starts_on, expires_on) values
  (995000001, 'trial', 25, 'USD', 'monthly', current_date, current_date + 14),
  (995000002, 'expired', 0, 'USD', 'monthly', current_date - 800, current_date - 1);
insert into public.license_contracts (organization_id, status, plan, module_keys, monthly_amount, billing_period, starts_on,
  price_locked_until, post_lock_monthly_amount, client_legal_name, signed_file_path, signed_at)
values (995000002, 'signed', 'founder', array['optical_sales'], 15, 'monthly', current_date - 800,
  current_date - 70, 19, 'Founder Late', '995000002/1/firmado.pdf', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);

do $$
declare failed boolean := false; result jsonb; first_expiry date;
begin
  if (select amount from public.subscriptions where organization_id = 995000001) <> 0 then
    raise exception 'A trial kept an amount';
  end if;

  begin
    perform public.record_subscription_payment(995000001, 'Pago sin contrato');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'Payment recorded without a signed contract'; end if;

  perform set_config('role', 'postgres', true);
  insert into public.license_contracts (organization_id, status, plan, module_keys, monthly_amount, billing_period, starts_on,
    client_legal_name, signed_file_path, signed_at)
  values (995000001, 'signed', 'basic', array['optical_sales', 'whatsapp'], 10, 'quarterly', current_date,
    'Trial Optics', '995000001/1/firmado.pdf', now());
  perform set_config('role', 'authenticated', true);

  result := public.record_subscription_payment(995000001, 'Primer pago trimestral');
  -- Paying during the trial keeps the free days: the paid period starts after the trial.
  first_expiry := (current_date + 15 + interval '3 months' - interval '1 day')::date;
  if (result ->> 'amount')::numeric <> 30 or (result ->> 'expiresOn')::date <> first_expiry then
    raise exception 'Wrong first payment %', result;
  end if;
  if (select status from public.subscriptions where organization_id = 995000001) <> 'active' then
    raise exception 'Payment did not activate the subscription';
  end if;

  result := public.record_subscription_payment(995000001, 'Renovación anticipada');
  if (result ->> 'expiresOn')::date <> (first_expiry + 1 + interval '3 months' - interval '1 day')::date then
    raise exception 'Renewal did not extend from the running period %', result;
  end if;

  -- A paid subscription never goes back to trial.
  perform set_config('role', 'postgres', true);
  failed := false;
  begin
    update public.subscriptions set status = 'trial' where organization_id = 995000001;
  exception when others then failed := true;
  end;
  if not failed then raise exception 'A paid subscription went back to trial'; end if;
  perform set_config('role', 'authenticated', true);

  -- Founder past the 24-month lock pays the post-lock price.
  result := public.record_subscription_payment(995000002, 'Pago tras el periodo fundador');
  if (result ->> 'amount')::numeric <> 19 then raise exception 'Founder lock not applied %', result; end if;
end $$;

-- No trial after onboarding: an expired organization cannot become a trial; a running
-- trial can still have its end date corrected.
do $$
declare failed boolean := false;
begin
  perform set_config('role', 'postgres', true);
  insert into public.organizations (id, name, order_prefix) overriding system value values (995000003, 'Expired Optics', 'EXP');
  insert into public.subscriptions (organization_id, status, amount, currency, billing_period, starts_on, expires_on)
  values (995000003, 'expired', 0, 'USD', 'monthly', current_date - 60, current_date - 30);
  begin
    update public.subscriptions set status = 'trial', expires_on = current_date + 15 where organization_id = 995000003;
  exception when others then failed := true;
  end;
  if not failed then raise exception 'An expired organization got a trial'; end if;
  insert into public.organizations (id, name, order_prefix) overriding system value values (995000004, 'Running Trial', 'RUN');
  insert into public.subscriptions (organization_id, status, amount, currency, billing_period, starts_on, expires_on)
  values (995000004, 'trial', 0, 'USD', 'monthly', current_date, current_date + 60);
  update public.subscriptions set expires_on = current_date + 14 where organization_id = 995000004;
  if (select expires_on from public.subscriptions where organization_id = 995000004) <> current_date + 14 then
    raise exception 'Trial end date could not be corrected';
  end if;
end $$;

rollback;
