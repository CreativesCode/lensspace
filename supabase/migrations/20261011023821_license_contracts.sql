-- License pricing and contracts (prp-license-pricing-and-contracts.md).
-- The platform admin records what each organization pays and for how long, prints a
-- contract proforma, uploads the signed copy and grants referral credits. Everything
-- here is platform-admin only; tenants never read these tables.

-- Provider (platform owner) legal data printed on every proforma. One row.
create table public.platform_provider_profile (
  id boolean primary key default true check (id),
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 200),
  identification text check (char_length(identification) <= 60),
  address text check (char_length(address) <= 300),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 200),
  payment_instructions text check (char_length(payment_instructions) <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.platform_provider_profile enable row level security;

create policy platform_provider_profile_select_admin on public.platform_provider_profile
for select to authenticated using ((select private.is_platform_admin()));
create policy platform_provider_profile_insert_admin on public.platform_provider_profile
for insert to authenticated with check ((select private.is_platform_admin()));
create policy platform_provider_profile_update_admin on public.platform_provider_profile
for update to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));

revoke all on public.platform_provider_profile from public, anon, authenticated;
grant select, insert, update on public.platform_provider_profile to authenticated;

create trigger platform_provider_profile_set_updated_at
before update on public.platform_provider_profile
for each row execute function private.set_updated_at();

create table public.license_contracts (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'signed', 'superseded', 'cancelled')),
  plan text not null check (plan in ('basic', 'complete', 'founder', 'custom')),
  module_keys text[] not null default array[]::text[],
  extra_branches smallint not null default 0 check (extra_branches between 0 and 50),
  monthly_amount numeric(10, 2) not null check (monthly_amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'quarterly', 'semiannual', 'annual')),
  -- Derived by trigger: what is charged each billing period (annual = 10 months).
  period_amount numeric(10, 2) not null default 0,
  starts_on date not null,
  term_months smallint not null default 12 check (term_months between 1 and 60),
  ends_on date not null,
  -- Founder partner: the monthly price is fixed until this date, then post_lock applies.
  price_locked_until date,
  post_lock_monthly_amount numeric(10, 2) check (post_lock_monthly_amount >= 0),
  client_legal_name text not null check (char_length(btrim(client_legal_name)) between 2 and 200),
  client_identification text check (char_length(client_identification) <= 60),
  client_representative text check (char_length(client_representative) <= 200),
  client_address text check (char_length(client_address) <= 300),
  client_phone text check (char_length(client_phone) <= 40),
  client_email text check (char_length(client_email) <= 200),
  notes text check (char_length(notes) <= 1000),
  referred_by_organization_id bigint references public.organizations(id) on delete restrict,
  referral_credit_days smallint,
  referral_credit_applied_on date,
  signed_file_path text,
  signed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referred_by_organization_id is distinct from organization_id),
  check ((plan = 'founder') = (price_locked_until is not null and post_lock_monthly_amount is not null)),
  check ((status in ('signed', 'superseded')) = (signed_file_path is not null and signed_at is not null) or status = 'cancelled'),
  check ((referral_credit_applied_on is null) = (referral_credit_days is null))
);

create unique index license_contracts_one_signed_idx
  on public.license_contracts (organization_id) where status = 'signed';
create index license_contracts_organization_idx on public.license_contracts (organization_id, created_at desc);
create index license_contracts_referred_by_idx
  on public.license_contracts (referred_by_organization_id) where referred_by_organization_id is not null;
create index license_contracts_created_by_idx on public.license_contracts (created_by);

alter table public.license_contracts enable row level security;

create policy license_contracts_select_admin on public.license_contracts
for select to authenticated using ((select private.is_platform_admin()));
create policy license_contracts_insert_admin on public.license_contracts
for insert to authenticated
with check ((select private.is_platform_admin()) and status = 'draft');
-- Only drafts are edited directly; signing, cancelling and credits go through RPCs.
create policy license_contracts_update_draft_admin on public.license_contracts
for update to authenticated
using ((select private.is_platform_admin()) and status = 'draft')
with check ((select private.is_platform_admin()) and status = 'draft');

revoke all on public.license_contracts from public, anon, authenticated;
grant select on public.license_contracts to authenticated;
grant insert (
  organization_id, plan, module_keys, extra_branches, monthly_amount, currency, billing_period,
  starts_on, term_months, price_locked_until, post_lock_monthly_amount, client_legal_name,
  client_identification, client_representative, client_address, client_phone, client_email,
  notes, referred_by_organization_id
) on public.license_contracts to authenticated;
grant update (
  plan, module_keys, extra_branches, monthly_amount, currency, billing_period,
  starts_on, term_months, price_locked_until, post_lock_monthly_amount, client_legal_name,
  client_identification, client_representative, client_address, client_phone, client_email,
  notes, referred_by_organization_id
) on public.license_contracts to authenticated;
grant usage, select on sequence public.license_contracts_id_seq to authenticated;

-- Derives the period amount and end date, validates modules and audits draft changes.
create or replace function private.prepare_license_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status <> 'draft' and new.status = old.status
    and (new.plan, new.module_keys, new.monthly_amount, new.billing_period, new.starts_on, new.term_months)
      is distinct from (old.plan, old.module_keys, old.monthly_amount, old.billing_period, old.starts_on, old.term_months) then
    raise exception using errcode = '55000', message = 'Un contrato firmado no se modifica: prepara uno nuevo.';
  end if;
  if exists (
    select 1 from unnest(new.module_keys) requested_key
    where not exists (select 1 from public.modules module where module.key = requested_key and module.is_active)
  ) then
    raise exception using errcode = '22023', message = 'El contrato contiene módulos inválidos.';
  end if;
  new.currency := upper(new.currency);
  new.client_legal_name := btrim(new.client_legal_name);
  new.period_amount := new.monthly_amount * case new.billing_period
    when 'quarterly' then 3 when 'semiannual' then 6 when 'annual' then 10 else 1 end;
  new.ends_on := (new.starts_on + make_interval(months => new.term_months) - interval '1 day')::date;
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger license_contracts_prepare
before insert or update on public.license_contracts
for each row execute function private.prepare_license_contract();

create trigger license_contracts_set_updated_at
before update on public.license_contracts
for each row execute function private.set_updated_at();

create or replace function private.audit_license_contract_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'draft' then
    return new;
  end if;
  insert into public.audit_events (organization_id, actor_user_id, event_type, entity_type, entity_id, origin, payload)
  values (
    new.organization_id, (select auth.uid()),
    case tg_op when 'INSERT' then 'license.contract_drafted' else 'license.contract_draft_changed' end,
    'license_contract', new.id::text, 'support',
    jsonb_build_object('plan', new.plan, 'monthlyAmount', new.monthly_amount, 'currency', new.currency,
      'billingPeriod', new.billing_period, 'startsOn', new.starts_on, 'endsOn', new.ends_on,
      'priceLockedUntil', new.price_locked_until, 'modules', new.module_keys,
      'referredBy', new.referred_by_organization_id)
  );
  return new;
end;
$$;

create trigger license_contracts_audit_draft
after insert or update on public.license_contracts
for each row execute function private.audit_license_contract_draft();

revoke all on function private.prepare_license_contract(), private.audit_license_contract_draft()
  from public, anon, authenticated;

-- Signed copies: {organization_id}/{contract_id}/{file}. Platform admin only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('license-contracts', 'license-contracts', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy license_contracts_files_select_admin on storage.objects
for select to authenticated
using (bucket_id = 'license-contracts' and (select private.is_platform_admin()));
create policy license_contracts_files_insert_admin on storage.objects
for insert to authenticated
with check (
  bucket_id = 'license-contracts'
  and (select private.is_platform_admin())
  and name ~ '^[0-9]+/[0-9]+/[^/]+$'
);
create policy license_contracts_files_delete_unregistered on storage.objects
for delete to authenticated
using (
  bucket_id = 'license-contracts'
  and (select private.is_platform_admin())
  and not exists (select 1 from public.license_contracts contract where contract.signed_file_path = name)
);

-- Marks a draft as signed with its uploaded copy, supersedes the previous signed
-- contract and syncs amount/currency/period into the subscription. Activation and
-- expiry stay manual because they depend on the payment.
create or replace function public.sign_license_contract(target_contract_id bigint, signed_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare contract public.license_contracts%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede registrar contratos.';
  end if;
  select * into contract from public.license_contracts where id = target_contract_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Contrato no encontrado.'; end if;
  if contract.status <> 'draft' then
    raise exception using errcode = '55000', message = 'Este contrato ya no es un borrador.';
  end if;
  if signed_path is null or signed_path !~ ('^' || contract.organization_id || '/' || contract.id || '/[^/]+$')
    or not exists (select 1 from storage.objects object where object.bucket_id = 'license-contracts' and object.name = signed_path) then
    raise exception using errcode = '22023', message = 'Sube primero el contrato firmado.';
  end if;

  update public.license_contracts set status = 'superseded', updated_at = now()
  where organization_id = contract.organization_id and status = 'signed';
  update public.license_contracts
  set status = 'signed', signed_file_path = signed_path, signed_at = now(), updated_at = now()
  where id = contract.id;

  update public.subscriptions set
    amount = contract.period_amount,
    currency = contract.currency,
    billing_period = contract.billing_period,
    updated_at = now()
  where organization_id = contract.organization_id;

  perform private.write_platform_audit(
    contract.organization_id, 'license.contract_signed', 'license_contract', contract.id::text,
    'Contrato firmado registrado',
    jsonb_build_object('plan', contract.plan, 'periodAmount', contract.period_amount, 'currency', contract.currency,
      'billingPeriod', contract.billing_period, 'startsOn', contract.starts_on, 'endsOn', contract.ends_on,
      'priceLockedUntil', contract.price_locked_until, 'file', signed_path)
  );
  return jsonb_build_object('contractId', contract.id, 'signed', true);
end;
$$;

create or replace function public.cancel_license_contract(target_contract_id bigint, cancel_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare contract public.license_contracts%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede anular contratos.';
  end if;
  if char_length(btrim(coalesce(cancel_reason, ''))) < 10 then
    raise exception using errcode = '22023', message = 'Explica el motivo (mínimo 10 caracteres).';
  end if;
  update public.license_contracts set status = 'cancelled', updated_at = now()
  where id = target_contract_id and status in ('draft', 'signed')
  returning * into contract;
  if not found then return false; end if;
  perform private.write_platform_audit(
    contract.organization_id, 'license.contract_cancelled', 'license_contract', contract.id::text,
    cancel_reason, jsonb_build_object('plan', contract.plan)
  );
  return true;
end;
$$;

-- Referral reward: once the referred organization paid its first period
-- (last_renewed_on set), the referrer's subscription is extended. 15 days while the
-- referrer holds an active founder price lock, 10 days otherwise. Once per referred
-- organization.
create or replace function public.apply_referral_credit(target_contract_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  contract public.license_contracts%rowtype;
  credit_days smallint;
  new_expiry date;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede aplicar créditos.';
  end if;
  select * into contract from public.license_contracts where id = target_contract_id for update;
  if not found or contract.referred_by_organization_id is null then
    raise exception using errcode = 'P0002', message = 'Este contrato no tiene óptica referente.';
  end if;
  if contract.status not in ('signed', 'superseded') then
    raise exception using errcode = '55000', message = 'El contrato referido aún no está firmado.';
  end if;
  if exists (
    select 1 from public.license_contracts other
    where other.organization_id = contract.organization_id and other.referral_credit_applied_on is not null
  ) then
    raise exception using errcode = '23505', message = 'El crédito por esta óptica ya se aplicó.';
  end if;
  if not exists (
    select 1 from public.subscriptions subscription
    where subscription.organization_id = contract.organization_id and subscription.last_renewed_on is not null
  ) then
    raise exception using errcode = '55000', message = 'La óptica referida todavía no ha pagado su primer periodo.';
  end if;

  credit_days := case when exists (
    select 1 from public.license_contracts referrer
    where referrer.organization_id = contract.referred_by_organization_id
      and referrer.status = 'signed' and referrer.plan = 'founder'
      and referrer.price_locked_until >= current_date
  ) then 15 else 10 end;

  update public.subscriptions
  set expires_on = greatest(expires_on, current_date) + credit_days, updated_at = now()
  where organization_id = contract.referred_by_organization_id
  returning expires_on into new_expiry;
  if not found then
    raise exception using errcode = 'P0002', message = 'La óptica referente no tiene suscripción.';
  end if;

  update public.license_contracts
  set referral_credit_days = credit_days, referral_credit_applied_on = current_date, updated_at = now()
  where id = contract.id;

  perform private.write_platform_audit(
    contract.referred_by_organization_id, 'license.referral_credit_applied', 'license_contract', contract.id::text,
    'Crédito por óptica referida',
    jsonb_build_object('referredOrganizationId', contract.organization_id, 'days', credit_days, 'expiresOn', new_expiry)
  );
  return jsonb_build_object('days', credit_days, 'expiresOn', new_expiry);
end;
$$;

revoke all on function public.sign_license_contract(bigint, text), public.cancel_license_contract(bigint, text),
  public.apply_referral_credit(bigint) from public, anon;
grant execute on function public.sign_license_contract(bigint, text), public.cancel_license_contract(bigint, text),
  public.apply_referral_credit(bigint) to authenticated;
