-- QA-35: the order's production panel made 4 requests in 3 sequential stages. One
-- invoker call returns the current jobs and the possible assignees under the same RLS:
-- active lens/mounting providers of the order's organization, plus the caller as an
-- in-house workshop when they are owner or seller there.
create or replace function public.get_order_production_panel(target_order_id bigint)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  with sale_order as (
    select id, organization_id from public.orders where id = target_order_id
  ), assignee_roles as (
    select membership.user_id,
      case when membership.role in ('owner', 'seller') then 'in_house' else membership.role end as role
    from public.organization_memberships membership
    join sale_order on sale_order.organization_id = membership.organization_id
    where membership.status = 'active'
      and (membership.role in ('lens_provider', 'mounting_provider')
        or (membership.role in ('owner', 'seller') and membership.user_id = (select auth.uid())))
  ), jobs as (
    select job.id, job.job_type, job.status, job.provider_id
    from public.production_jobs job
    join sale_order on sale_order.id = job.order_id
    where job.is_current
  )
  select case when not exists (select 1 from sale_order) then null else jsonb_build_object(
    'jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', jobs.id, 'jobType', jobs.job_type, 'status', jobs.status, 'providerId', jobs.provider_id,
      'providerName', coalesce(profile.display_name, 'Proveedor')) order by jobs.id)
      from jobs left join public.profiles profile on profile.user_id = jobs.provider_id), '[]'::jsonb),
    'assignees', coalesce((select jsonb_agg(jsonb_build_object(
      'id', grouped.user_id, 'name', coalesce(profile.display_name, 'Proveedor'), 'roles', grouped.roles))
      from (select user_id, jsonb_agg(distinct role) as roles from assignee_roles group by user_id) grouped
      left join public.profiles profile on profile.user_id = grouped.user_id), '[]'::jsonb)
  ) end;
$function$;

revoke all on function public.get_order_production_panel(bigint) from public, anon;
grant execute on function public.get_order_production_panel(bigint) to authenticated;
