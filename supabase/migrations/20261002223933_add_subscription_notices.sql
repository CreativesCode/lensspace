-- QA-40: tell members when their organization is read-only and warn owners before
-- the trial or subscription ends. Owners see status and dates; other members only
-- whether the organization can operate (subscriptions stay owner-only under RLS).
create or replace function public.get_my_subscription_notices()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'organizationId', organization.id,
    'organizationName', organization.name,
    'canOperate', private.can_operate_in_organization(organization.id, 'core'),
    'isOwner', membership.is_owner,
    'subscriptionStatus', case when membership.is_owner then subscription.status end,
    'expiresOn', case when membership.is_owner then subscription.expires_on end,
    'daysLeft', case when membership.is_owner then subscription.expires_on - current_date end
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
  ) subscription on true;
$function$;

revoke all on function public.get_my_subscription_notices() from public, anon;
grant execute on function public.get_my_subscription_notices() to authenticated;
