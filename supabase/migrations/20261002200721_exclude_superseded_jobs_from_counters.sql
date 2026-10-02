-- QA-25: a job superseded by an accepted rework (is_current = false) is history, not
-- active work. Exclude it from the sidebar counter and expose isCurrent to the UI.

create or replace function public.get_navigation_counters()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select jsonb_build_object(
    'ordersWithBalance', (
      select count(*)
      from public.orders sale_order
      where sale_order.commercial_status not in ('delivered', 'closed')
        and sale_order.cup_equivalent > coalesce((
          select sum(payment.equivalent_cup) from public.payments payment where payment.order_id = sale_order.id
        ), 0)
    ),
    'activeProductionJobs', (
      select count(*)
      from public.production_jobs job
      where job.is_current
        and job.status not in ('received', 'reviewed')
    )
  );
$function$;

create or replace function public.list_accessible_production_jobs()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', job.id, 'orderId', job.order_id, 'orderNumber', job.work_snapshot ->> 'orderNumber',
    'jobType', job.job_type, 'providerId', job.provider_id,
    'providerName', provider.display_name, 'status', job.status, 'isCurrent', job.is_current,
    'snapshot', job.work_snapshot, 'originalJobId', job.original_job_id,
    'assignedAt', job.assigned_at, 'dispatchedAt', job.dispatched_at,
    'completedAt', job.completed_at, 'receivedAt', job.received_at,
    'incidents', coalesce((select jsonb_agg(jsonb_build_object(
      'id', incident.id, 'description', incident.description,
      'costResponsibility', incident.cost_responsibility, 'openedAt', incident.opened_at,
      'reworkJobId', incident.rework_job_id
    ) order by incident.opened_at) from public.production_incidents incident where incident.job_id = job.id), '[]'::jsonb)
  ) order by job.assigned_at desc), '[]'::jsonb)
  from public.production_jobs job
  join public.profiles provider on provider.user_id = job.provider_id;
$function$;
