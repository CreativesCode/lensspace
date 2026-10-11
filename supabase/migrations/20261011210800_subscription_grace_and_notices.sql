-- Payment grace period and expiry notices (product owner, 2026-10-11).
-- Cuba pays in cash or Zelle, so an organization keeps operating 5 days after its
-- trial or paid period ends (expires_on = last covered day) and is blocked on the
-- 6th. Example: expires on the 5th → owner WhatsApp daily on the 3rd..10th, admin
-- WhatsApp on the 5th, read-only from the 11th with a notice to owner and admin.

create or replace function private.subscription_grace_days()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

revoke all on function private.subscription_grace_days() from public, anon;
grant execute on function private.subscription_grace_days() to authenticated;

create or replace function private.can_operate_in_organization(target_organization_id bigint, required_module_key text default 'core')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select private.is_active_organization_member(target_organization_id))
    and exists (
      select 1
      from public.organizations o
      join public.subscriptions s on s.organization_id = o.id
      where o.id = target_organization_id
        and o.status = 'active'
        and s.status in ('trial', 'active')
        and current_date between s.starts_on and s.expires_on + private.subscription_grace_days()
    )
    and (
      required_module_key = 'core'
      or exists (
        select 1
        from public.organization_modules omod
        join public.modules m on m.key = omod.module_key and m.is_active
        where omod.organization_id = target_organization_id
          and omod.module_key = required_module_key
          and omod.is_enabled
      )
    );
$$;

-- A payment inside the grace period continues the paid period (the grace days are not
-- free); after the block, or after a trial, the new period starts today.
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
  covered_from := case when subscription.status = 'active' and subscription.expires_on + private.subscription_grace_days() >= current_date
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

-- Web banner data: owners also get the grace end and how to reach the admin.
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

-- WhatsApp notices about the subscription. One row per notice; notice_key makes the
-- daily job idempotent (a rerun never sends the same notice twice).
create table private.subscription_notices (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  notice_key text not null unique,
  kind text not null check (kind in ('owner_reminder', 'owner_due', 'owner_grace', 'owner_blocked', 'admin_due', 'admin_blocked')),
  recipient text,
  message text not null,
  status text not null default 'requested' check (status in ('requested', 'sent', 'failed')),
  failure_code text,
  failure_message text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index subscription_notices_organization_idx on private.subscription_notices (organization_id, created_at desc);

create or replace function private.queue_subscription_notice(
  target_organization_id bigint, target_key text, target_kind text, target_recipient text, target_message text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  notice_id bigint;
  project_url text;
  notify_secret text;
begin
  insert into private.subscription_notices (organization_id, notice_key, kind, recipient, message)
  values (target_organization_id, target_key, target_kind, nullif(btrim(coalesce(target_recipient, '')), ''), target_message)
  on conflict (notice_key) do nothing
  returning id into notice_id;
  if notice_id is null then return; end if;

  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'vision_studio_project_url';
  select decrypted_secret into notify_secret from vault.decrypted_secrets where name = 'vision_studio_wa_notify_secret';
  if nullif(project_url, '') is null or nullif(notify_secret, '') is null then
    raise warning 'Subscription notice % queued without runtime configuration', notice_id;
    return;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/send-subscription-notice',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-wa-secret', notify_secret),
    body := jsonb_build_object('noticeId', notice_id),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'queue_subscription_notice failed for %: %', target_key, sqlerrm;
end;
$$;

-- Daily job: owner reminders from 2 days before until the last grace day, the admin
-- on the expiry day, and on the block day both of them; then the subscription is
-- marked expired so the panel shows it as blocked.
create or replace function private.run_subscription_notices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  grace integer := private.subscription_grace_days();
  today date := current_date;
  admin_name text;
  admin_phone text;
  contact text;
  queued integer := 0;
  item record;
  label text;
  blocked_on text;
  owner_line text;
begin
  select legal_name, phone into admin_name, admin_phone from public.platform_provider_profile limit 1;
  contact := case when nullif(admin_phone, '') is not null
    then format(' Contacta a %s al %s.', coalesce(admin_name, 'LensSpace'), admin_phone)
    else ' Contacta a LensSpace.' end;

  for item in
    select organization.id, organization.name, subscription.status, subscription.expires_on,
      subscription.expires_on - today as days_left,
      owner.display_name as owner_name,
      coalesce(nullif(owner.phone, ''), contract.client_phone) as owner_phone,
      owner_user.email as owner_email
    from public.organizations organization
    join public.subscriptions subscription on subscription.organization_id = organization.id
    left join lateral (
      select profile.user_id, profile.display_name, profile.phone
      from public.organization_memberships membership
      join public.profiles profile on profile.user_id = membership.user_id
      where membership.organization_id = organization.id and membership.role = 'owner' and membership.status = 'active'
      order by membership.created_at limit 1
    ) owner on true
    left join auth.users owner_user on owner_user.id = owner.user_id
    left join public.license_contracts contract on contract.organization_id = organization.id and contract.status = 'signed'
    where organization.status = 'active'
      and subscription.status in ('trial', 'active')
      and subscription.expires_on - today <= 2
  loop
    label := case item.status when 'trial' then 'la prueba' else 'la suscripción' end;
    blocked_on := to_char(item.expires_on + grace + 1, 'DD/MM/YYYY');
    owner_line := format('Dueño: %s, tel. %s, correo %s.', coalesce(item.owner_name, '—'), coalesce(item.owner_phone, 'sin teléfono'), coalesce(item.owner_email, '—'));

    if item.days_left between 1 and 2 then
      perform private.queue_subscription_notice(item.id, format('%s:owner_reminder:%s', item.id, today), 'owner_reminder', item.owner_phone,
        format('LensSpace: %s de %s vence el %s. Realiza el pago para seguir trabajando sin interrupciones.%s',
          label, item.name, to_char(item.expires_on, 'DD/MM/YYYY'), contact));
      queued := queued + 1;
    elsif item.days_left = 0 then
      perform private.queue_subscription_notice(item.id, format('%s:owner_due:%s', item.id, today), 'owner_due', item.owner_phone,
        format('LensSpace: %s de %s vence hoy. Tienes %s días para pagar: el %s el sistema pasará a solo lectura.%s',
          label, item.name, grace, blocked_on, contact));
      perform private.queue_subscription_notice(item.id, format('%s:admin_due:%s', item.id, today), 'admin_due', admin_phone,
        format('LensSpace (admin): %s de %s vence hoy. Si no paga, se bloquea el %s. %s',
          label, item.name, blocked_on, owner_line));
      queued := queued + 2;
    elsif item.days_left between -grace and -1 then
      perform private.queue_subscription_notice(item.id, format('%s:owner_grace:%s', item.id, today), 'owner_grace', item.owner_phone,
        format('LensSpace: %s de %s venció el %s. Quedan %s día(s) para pagar: el %s el sistema pasará a solo lectura.%s',
          label, item.name, to_char(item.expires_on, 'DD/MM/YYYY'), grace + item.days_left + 1, blocked_on, contact));
      queued := queued + 1;
    elsif item.days_left < -grace then
      perform private.queue_subscription_notice(item.id, format('%s:owner_blocked:%s', item.id, item.expires_on), 'owner_blocked', item.owner_phone,
        format('LensSpace: %s está en solo lectura porque %s venció el %s y no se registró el pago. Puedes consultar tus datos; para volver a trabajar, paga.%s',
          item.name, label, to_char(item.expires_on, 'DD/MM/YYYY'), contact));
      perform private.queue_subscription_notice(item.id, format('%s:admin_blocked:%s', item.id, item.expires_on), 'admin_blocked', admin_phone,
        format('LensSpace (admin): %s quedó en solo lectura (%s venció el %s sin pago). %s',
          item.name, label, to_char(item.expires_on, 'DD/MM/YYYY'), owner_line));
      update public.subscriptions set status = 'expired', updated_at = now()
      where organization_id = item.id and status in ('trial', 'active');
      queued := queued + 2;
    end if;
  end loop;
  return queued;
end;
$$;

revoke all on function private.queue_subscription_notice(bigint, text, text, text, text), private.run_subscription_notices()
  from public, anon, authenticated;

-- Edge Function (service role) reads a notice and records the outcome.
create or replace function public.get_subscription_notice_payload(target_notice_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('noticeId', id, 'status', status, 'recipient', recipient, 'message', message)
  from private.subscription_notices where id = target_notice_id;
$$;

create or replace function public.complete_subscription_notice(
  target_notice_id bigint, target_outcome text, target_failure_code text, target_failure_message text, target_message_id text
) returns void
language sql
security definer
set search_path = ''
as $$
  update private.subscription_notices set
    status = case when target_outcome = 'sent' then 'sent' else 'failed' end,
    failure_code = target_failure_code,
    failure_message = left(target_failure_message, 500),
    provider_message_id = target_message_id,
    completed_at = now()
  where id = target_notice_id and status = 'requested';
$$;

revoke all on function public.get_subscription_notice_payload(bigint),
  public.complete_subscription_notice(bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_subscription_notice_payload(bigint),
  public.complete_subscription_notice(bigint, text, text, text, text) to service_role;

-- The admin sees the last notices of an organization in its detail.
create or replace function public.list_subscription_notices(target_organization_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede ver los avisos.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('kind', kind, 'status', status, 'createdAt', created_at, 'failureCode', failure_code) order by created_at desc)
    from (select * from private.subscription_notices where organization_id = target_organization_id order by created_at desc limit 10) recent
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_subscription_notices(bigint) from public, anon;
grant execute on function public.list_subscription_notices(bigint) to authenticated;

-- Daily at 14:00 UTC (10:00 in Havana during daylight time, 09:00 in winter).
create extension if not exists pg_cron;
select cron.schedule('lensspace-subscription-notices', '0 14 * * *', 'select private.run_subscription_notices()');
