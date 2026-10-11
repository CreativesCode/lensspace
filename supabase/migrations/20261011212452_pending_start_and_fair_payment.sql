-- Product owner, 2026-10-11:
-- 1. An organization created without a trial is not "expired": it is 'pending' (en
--    preparación) until its contract is signed and the first payment is recorded.
--    It cannot operate, gets no expiry notices, and can never move into a trial.
-- 2. The grace days are never free. A payment continues from the day after the last
--    covered day; after the block, the days the organization could not operate are
--    not charged, but the grace days it used are: covered_from =
--    greatest(expires_on + 1, today - grace). Example: expires on the 5th, pays on the
--    20th → the period starts on the 15th (the 6th..10th were used, the 11th..19th not).

alter table public.subscriptions drop constraint subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('pending', 'trial', 'active', 'expired', 'suspended'));

-- 'test' was created without a trial before this status existed.
update public.subscriptions set status = 'pending', amount = 0, updated_at = now()
where status = 'expired' and last_renewed_on is null and starts_on = expires_on;

create or replace function private.zero_trial_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('trial', 'pending') then
    new.amount := 0;
  end if;
  return new;
end;
$$;

create or replace function private.guard_trial_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'trial' and tg_op = 'UPDATE' and (old.status <> 'trial' or old.last_renewed_on is not null) then
    raise exception using errcode = '55000', message = 'La prueba solo se da al crear la organización.';
  end if;
  if new.status = 'pending' and tg_op = 'UPDATE' and old.status <> 'pending' then
    raise exception using errcode = '55000', message = 'Solo una organización recién creada y sin prueba está en preparación.';
  end if;
  return new;
end;
$$;

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
  -- The first payment of an organization in preparation starts today; otherwise the
  -- grace days used are charged (see the header).
  covered_from := case when subscription.status = 'pending' then current_date
    else greatest(subscription.expires_on + 1, current_date - private.subscription_grace_days()) end;
  new_expiry := (covered_from + make_interval(months => period_months) - interval '1 day')::date;

  update public.subscriptions set
    status = 'active',
    amount = charged,
    currency = contract.currency,
    billing_period = contract.billing_period,
    starts_on = case when subscription.status = 'pending' then covered_from else least(starts_on, covered_from) end,
    expires_on = new_expiry,
    last_renewed_on = current_date,
    updated_at = now()
  where id = subscription.id;

  perform private.write_platform_audit(
    target_organization_id, 'subscription.payment_recorded', 'subscription', subscription.id::text, payment_note,
    jsonb_build_object('amount', charged, 'currency', contract.currency, 'billingPeriod', contract.billing_period,
      'coveredFrom', covered_from, 'expiresOn', new_expiry, 'contractId', contract.id)
  );
  return jsonb_build_object('amount', charged, 'currency', contract.currency, 'coveredFrom', covered_from, 'expiresOn', new_expiry);
end;
$$;

-- Members of an organization in preparation see why it is read-only.
create or replace function public.get_my_subscription_notices()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'organizationId', organization.id,
    'organizationName', organization.name,
    'canOperate', private.can_operate_in_organization(organization.id, 'core'),
    'isOwner', membership.is_owner,
    'isPending', coalesce(subscription.status = 'pending', false),
    'subscriptionStatus', case when membership.is_owner then subscription.status end,
    'expiresOn', case when membership.is_owner then subscription.expires_on end,
    'daysLeft', case when membership.is_owner then subscription.expires_on - current_date end,
    'graceEndsOn', case when membership.is_owner then subscription.expires_on + private.subscription_grace_days() end,
    'adminName', case when membership.is_owner then provider.legal_name end,
    'adminPhone', case when membership.is_owner then provider.phone end
  ) order by organization.name), '[]'::jsonb)
  from (
    select organization_id, bool_or(role = 'owner') as is_owner
    from public.organization_memberships
    where user_id = (select auth.uid()) and status = 'active'
    group by organization_id
  ) membership
  join public.organizations organization on organization.id = membership.organization_id
  left join lateral (
    select status, expires_on from public.subscriptions
    where organization_id = organization.id
    order by expires_on desc
    limit 1
  ) subscription on true
  left join public.platform_provider_profile provider on true;
$$;

-- The admin form saves the current status back: 'pending' must be accepted (the guard
-- trigger still forbids moving into it).
create or replace function public.update_platform_organization(target_organization_id bigint, target_organization_status text, target_subscription_status text, target_amount numeric, target_currency text, target_billing_period text, target_starts_on date, target_expires_on date, target_module_keys text[], change_reason text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare requested text[] := coalesce(target_module_keys, array[]::text[]);
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede cambiar el contrato.';
  end if;
  if char_length(btrim(change_reason)) < 10 then
    raise exception using errcode = '22023', message = 'Explica el motivo del cambio (mínimo 10 caracteres).';
  end if;
  if target_organization_status not in ('active', 'suspended', 'archived')
    or target_subscription_status not in ('pending', 'trial', 'active', 'expired', 'suspended')
    or target_amount < 0
    or upper(target_currency) !~ '^[A-Z]{3}$'
    or target_billing_period not in ('monthly', 'quarterly', 'semiannual', 'annual', 'custom')
    or target_expires_on < target_starts_on then
    raise exception using errcode = '22023', message = 'La configuración del contrato es inválida.';
  end if;
  if 'core' = any(requested) or exists (
    select 1 from unnest(requested) requested_key
    where not exists (select 1 from public.modules module where module.key = requested_key and module.is_active)
  ) then
    raise exception using errcode = '22023', message = 'La selección contiene módulos opcionales inválidos.';
  end if;
  if exists (
    select 1 from public.module_dependencies dependency
    where dependency.module_key = any(requested)
      and dependency.depends_on_module_key <> 'core'
      and not dependency.depends_on_module_key = any(requested)
  ) then
    raise exception using errcode = '23514', message = 'Faltan dependencias de módulos seleccionados.';
  end if;

  update public.organization_modules
  set is_enabled = false, changed_at = now(), changed_by = (select auth.uid())
  where organization_id = target_organization_id
    and module_key in ('cashbox', 'production', 'whatsapp')
    and not module_key = any(requested) and is_enabled;
  update public.organization_modules
  set is_enabled = false, changed_at = now(), changed_by = (select auth.uid())
  where organization_id = target_organization_id
    and module_key in ('analytics', 'multi_branch')
    and not module_key = any(requested) and is_enabled;
  update public.organization_modules
  set is_enabled = false, changed_at = now(), changed_by = (select auth.uid())
  where organization_id = target_organization_id
    and module_key = 'optical_sales' and not module_key = any(requested) and is_enabled;

  insert into public.organization_modules (organization_id, module_key, is_enabled, changed_by)
  select target_organization_id, requested_key, true, (select auth.uid())
  from unnest(requested) requested_key
  order by case requested_key when 'optical_sales' then 1 when 'multi_branch' then 2 else 3 end
  on conflict (organization_id, module_key) do update set
    is_enabled = true, changed_at = now(), changed_by = excluded.changed_by;

  update public.organizations
  set status = target_organization_status, updated_at = now()
  where id = target_organization_id;
  if not found then raise exception using errcode = 'P0002', message = 'Organización no encontrada.'; end if;

  update public.subscriptions set
    status = target_subscription_status,
    amount = target_amount,
    currency = upper(target_currency),
    billing_period = target_billing_period,
    starts_on = target_starts_on,
    expires_on = target_expires_on,
    last_renewed_on = case
      when target_subscription_status = 'active'
        and (status <> 'active' or target_expires_on > expires_on) then current_date
      else last_renewed_on
    end,
    updated_at = now()
  where organization_id = target_organization_id;

  perform private.write_platform_audit(
    target_organization_id, 'organization.contract_changed', 'organization',
    target_organization_id::text, change_reason,
    jsonb_build_object(
      'organizationStatus', target_organization_status,
      'subscriptionStatus', target_subscription_status,
      'amount', target_amount,
      'currency', upper(target_currency),
      'billingPeriod', target_billing_period,
      'startsOn', target_starts_on,
      'expiresOn', target_expires_on,
      'modules', requested
    )
  );
  return jsonb_build_object('organizationId', target_organization_id, 'updated', true);
end;
$$;
