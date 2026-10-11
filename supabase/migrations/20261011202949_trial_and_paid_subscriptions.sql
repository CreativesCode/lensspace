-- Trial vs paid subscriptions (product owner, 2026-10-11).
-- A trial is free and time-boxed (15 days or a month, only when granted); when it
-- ends the organization is read-only until a payment turns it into an active
-- subscription priced from the signed license contract.

-- A trial never carries an amount, whatever path writes the subscription.
create or replace function private.zero_trial_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'trial' then
    new.amount := 0;
  end if;
  return new;
end;
$$;

revoke all on function private.zero_trial_amount() from public, anon, authenticated;

create trigger subscriptions_zero_trial_amount
before insert or update on public.subscriptions
for each row execute function private.zero_trial_amount();

update public.subscriptions set amount = 0, updated_at = now() where status = 'trial' and amount <> 0;

-- Records a license payment: the subscription becomes (or stays) active, charged from
-- the signed contract, and its expiry moves forward one billing period. A founder
-- contract past its price lock is charged at the post-lock price.
create or replace function public.record_subscription_payment(target_organization_id bigint, payment_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  contract public.license_contracts%rowtype;
  subscription public.subscriptions%rowtype;
  monthly numeric;
  charged numeric;
  period_months integer;
  covered_from date;
  new_expiry date;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede registrar pagos.';
  end if;
  select * into subscription from public.subscriptions where organization_id = target_organization_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'La organización no tiene suscripción.'; end if;
  if subscription.status = 'suspended' then
    raise exception using errcode = '55000', message = 'La suscripción está suspendida: reactívala antes de registrar el pago.';
  end if;
  select * into contract from public.license_contracts
  where organization_id = target_organization_id and status = 'signed';
  if not found then
    raise exception using errcode = '55000', message = 'Sube primero el contrato firmado: el importe sale de él.';
  end if;

  monthly := case when contract.price_locked_until is not null and current_date > contract.price_locked_until
    then contract.post_lock_monthly_amount else contract.monthly_amount end;
  charged := monthly * case contract.billing_period when 'quarterly' then 3 when 'semiannual' then 6 when 'annual' then 10 else 1 end;
  period_months := case contract.billing_period when 'quarterly' then 3 when 'semiannual' then 6 when 'annual' then 12 else 1 end;
  -- A running paid period is extended; otherwise the new period starts today.
  covered_from := case when subscription.status = 'active' and subscription.expires_on >= current_date
    then subscription.expires_on + 1 else current_date end;
  new_expiry := (covered_from + make_interval(months => period_months) - interval '1 day')::date;

  update public.subscriptions set
    status = 'active',
    amount = charged,
    currency = contract.currency,
    billing_period = contract.billing_period,
    starts_on = case when subscription.status = 'active' then starts_on else current_date end,
    expires_on = new_expiry,
    last_renewed_on = current_date,
    updated_at = now()
  where id = subscription.id;

  perform private.write_platform_audit(
    target_organization_id, 'subscription.payment_recorded', 'subscription', subscription.id::text, payment_note,
    jsonb_build_object('amount', charged, 'currency', contract.currency, 'billingPeriod', contract.billing_period,
      'coveredFrom', covered_from, 'expiresOn', new_expiry, 'contractId', contract.id)
  );
  return jsonb_build_object('amount', charged, 'currency', contract.currency, 'expiresOn', new_expiry);
end;
$$;

-- Grants a free trial only when the admin decides it; never over a running paid period.
create or replace function public.start_subscription_trial(target_organization_id bigint, trial_days integer, change_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription public.subscriptions%rowtype;
  new_expiry date;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede dar periodos de prueba.';
  end if;
  if trial_days not between 1 and 60 then
    raise exception using errcode = '22023', message = 'La prueba dura entre 1 y 60 días.';
  end if;
  select * into subscription from public.subscriptions where organization_id = target_organization_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'La organización no tiene suscripción.'; end if;
  if subscription.status = 'active' and subscription.expires_on >= current_date then
    raise exception using errcode = '55000', message = 'La óptica tiene un periodo pagado en curso.';
  end if;
  new_expiry := current_date + trial_days - 1;
  update public.subscriptions set
    -- starts_on keeps an earlier date so a past payment (last_renewed_on) stays valid.
    status = 'trial', starts_on = least(starts_on, current_date), expires_on = new_expiry, updated_at = now()
  where id = subscription.id;
  perform private.write_platform_audit(
    target_organization_id, 'subscription.trial_started', 'subscription', subscription.id::text, change_reason,
    jsonb_build_object('days', trial_days, 'expiresOn', new_expiry)
  );
  return jsonb_build_object('expiresOn', new_expiry);
end;
$$;

revoke all on function public.record_subscription_payment(bigint, text), public.start_subscription_trial(bigint, integer, text)
  from public, anon;
grant execute on function public.record_subscription_payment(bigint, text), public.start_subscription_trial(bigint, integer, text)
  to authenticated;
