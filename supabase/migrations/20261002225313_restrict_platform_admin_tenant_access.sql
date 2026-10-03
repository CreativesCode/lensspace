-- QA-38: the platform administrator is not an operational role (BUSINESS_LOGIC).
-- - Never operational writes: sales, payments, customers, prescriptions, production.
-- - Reading a tenant's operational data requires an active, audited support session
--   (platform_support_sessions) for that organization.
-- - Base catalog (organization_id is null) and platform administration are unchanged.

create or replace function private.has_platform_support_session(target_organization_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.is_platform_admin() and exists (
    select 1 from public.platform_support_sessions session
    where session.organization_id = target_organization_id
      and session.administrator_id = (select auth.uid())
      and session.ended_at is null
      and session.expires_at > now()
  );
$function$;

revoke all on function private.has_platform_support_session(bigint) from public, anon;
grant execute on function private.has_platform_support_session(bigint) to authenticated;

create or replace function private.can_operate_in_organization(target_organization_id bigint, required_module_key text default 'core')
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null
    and (select private.is_active_organization_member(target_organization_id))
    and exists (
      select 1
      from public.organizations o
      join public.subscriptions s on s.organization_id = o.id
      where o.id = target_organization_id
        and o.status = 'active'
        and s.status in ('trial', 'active')
        and current_date between s.starts_on and s.expires_on
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
$function$;

create or replace function private.can_read_branch_clinical_data(target_organization_id bigint, target_branch_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    private.has_platform_support_session(target_organization_id)
    or private.has_organization_role(target_organization_id, array['owner'])
    or exists (
      select 1
      from public.organization_memberships membership
      join public.profiles profile
        on profile.user_id = membership.user_id
        and profile.is_active
      where membership.organization_id = target_organization_id
        and membership.branch_id = target_branch_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'seller'
        and membership.status = 'active'
    );
$function$;

create or replace function private.can_write_branch_clinical_data(target_organization_id bigint, target_branch_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    (
      private.has_organization_role(target_organization_id, array['owner'])
      or exists (
        select 1
        from public.organization_memberships membership
        join public.profiles profile
          on profile.user_id = membership.user_id
          and profile.is_active
        where membership.organization_id = target_organization_id
          and membership.branch_id = target_branch_id
          and membership.user_id = (select auth.uid())
          and membership.role = 'seller'
          and membership.status = 'active'
      )
    )
    and private.can_operate_in_organization(target_organization_id, 'optical_sales');
$function$;

create or replace function private.can_access_seller_sale(target_organization_id bigint, target_branch_id bigint, target_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.has_platform_support_session(target_organization_id)
    or private.has_organization_role(target_organization_id, array['owner'])
    or exists (
      select 1 from public.organization_memberships membership
      where membership.organization_id = target_organization_id
        and membership.branch_id = target_branch_id
        and membership.user_id = (select auth.uid())
        and membership.user_id = target_seller_id
        and membership.role = 'seller'
        and membership.status = 'active'
    );
$function$;

-- The administrator manages the base catalog only; tenant overrides belong to owners.
create or replace function private.can_manage_commercial_catalog(target_organization_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    (target_organization_id is null and private.is_platform_admin())
    or (
      target_organization_id is not null
      and private.has_organization_role(target_organization_id, array['owner'])
      and private.can_operate_in_organization(target_organization_id, 'optical_sales')
    );
$function$;

create or replace function private.has_commercial_catalog_access(target_organization_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    (private.is_platform_admin() and (target_organization_id is null or private.has_platform_support_session(target_organization_id)))
    or exists (
      select 1
      from public.organization_memberships membership
      join public.profiles profile
        on profile.user_id = membership.user_id
        and profile.is_active
      where membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('owner', 'seller')
        and (
          target_organization_id is null
          or membership.organization_id = target_organization_id
        )
    );
$function$;

-- Usage counters are aggregate figures for the platform panel; they no longer depend
-- on the administrator reading tenant rows. The function still checks the role.
alter function public.get_platform_usage() security definer;
