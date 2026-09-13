-- Atomic organization onboarding used by the administrator Edge Function.

create or replace function public.current_user_is_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_platform_admin();
$$;

revoke all on function public.current_user_is_platform_admin() from public, anon;
grant execute on function public.current_user_is_platform_admin() to authenticated;

create or replace function public.bootstrap_organization(
  actor_user_id uuid,
  owner_user_id uuid,
  organization_name text,
  organization_prefix text,
  organization_timezone text,
  branch_name text,
  branch_code text,
  subscription_status text,
  subscription_amount numeric,
  subscription_currency text,
  subscription_billing_period text,
  subscription_starts_on date,
  subscription_expires_on date,
  enabled_module_keys text[]
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id bigint;
  new_branch_id bigint;
  normalized_prefix text := upper(btrim(organization_prefix));
  normalized_branch_code text := upper(btrim(branch_code));
  requested_module text;
begin
  if not exists (
    select 1
    from private.platform_admins pa
    where pa.user_id = actor_user_id
  ) then
    raise exception 'Only a platform administrator can onboard organizations.'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = owner_user_id
      and p.is_active
  ) then
    raise exception 'The owner profile does not exist or is inactive.'
      using errcode = 'foreign_key_violation';
  end if;

  if normalized_prefix !~ '^[A-Z0-9]{3,8}$' then
    raise exception 'The organization prefix must contain 3 to 8 uppercase letters or digits.'
      using errcode = 'check_violation';
  end if;

  if normalized_branch_code !~ '^[A-Z0-9_-]{1,16}$' then
    raise exception 'The branch code is invalid.'
      using errcode = 'check_violation';
  end if;

  foreach requested_module in array coalesce(enabled_module_keys, array[]::text[])
  loop
    if requested_module = 'core' or not exists (
      select 1 from public.modules m where m.key = requested_module and m.is_active
    ) then
      raise exception 'Unknown or invalid optional module: %', requested_module
        using errcode = 'check_violation';
    end if;
  end loop;

  if exists (
    select 1
    from public.module_dependencies dependency
    where dependency.module_key = any(coalesce(enabled_module_keys, array[]::text[]))
      and dependency.depends_on_module_key <> 'core'
      and not dependency.depends_on_module_key = any(coalesce(enabled_module_keys, array[]::text[]))
  ) then
    raise exception 'All dependencies of enabled modules must also be enabled.'
      using errcode = 'check_violation';
  end if;

  insert into public.organizations (name, order_prefix, timezone)
  values (btrim(organization_name), normalized_prefix, organization_timezone)
  returning id into new_organization_id;

  insert into public.branches (organization_id, name, code, timezone)
  values (
    new_organization_id,
    btrim(branch_name),
    normalized_branch_code,
    organization_timezone
  )
  returning id into new_branch_id;

  insert into public.subscriptions (
    organization_id,
    status,
    amount,
    currency,
    billing_period,
    starts_on,
    expires_on
  )
  values (
    new_organization_id,
    subscription_status,
    subscription_amount,
    upper(subscription_currency),
    subscription_billing_period,
    subscription_starts_on,
    subscription_expires_on
  );

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  )
  values (
    new_organization_id,
    owner_user_id,
    'owner',
    'active'
  );

  insert into public.organization_modules (
    organization_id,
    module_key,
    is_enabled,
    changed_by
  )
  select
    new_organization_id,
    requested.key,
    true,
    actor_user_id
  from (
    select distinct unnest(coalesce(enabled_module_keys, array[]::text[])) as key
  ) requested
  order by
    case requested.key
      when 'optical_sales' then 1
      when 'multi_branch' then 2
      else 3
    end;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    origin,
    payload
  )
  values (
    new_organization_id,
    actor_user_id,
    'organization.created',
    'organization',
    new_organization_id::text,
    'application',
    jsonb_build_object(
      'owner_user_id', owner_user_id,
      'branch_id', new_branch_id,
      'enabled_modules', coalesce(enabled_module_keys, array[]::text[])
    )
  );

  return new_organization_id;
end;
$$;

revoke all on function public.bootstrap_organization(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  date,
  date,
  text[]
) from public, anon, authenticated;

grant execute on function public.bootstrap_organization(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  date,
  date,
  text[]
) to service_role;
