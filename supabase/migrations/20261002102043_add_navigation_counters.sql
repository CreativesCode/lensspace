-- UI 2.0 navigation counters (prp-ui-2-0-design-migration, Fase 11). Security invoker:
-- RLS on orders, payments and production_jobs scopes the counts to what each caller
-- already sees in the orders inbox and the production page.
create or replace function public.get_navigation_counters()
returns jsonb language sql stable set search_path = '' as $$
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
      where job.status not in ('received', 'reviewed')
    )
  );
$$;

revoke all on function public.get_navigation_counters() from public, anon;
grant execute on function public.get_navigation_counters() to authenticated;
