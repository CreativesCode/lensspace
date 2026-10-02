-- QA-32: the dashboard needs 4 figures, not the whole order history (~330 B per
-- order). Same rules and RLS scope as list_accessible_orders, aggregated server-side.
create or replace function public.get_order_kpis()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  with orders as (
    select entry ->> 'commercialStatus' as commercial_status,
      (entry ->> 'balanceCup')::numeric as balance_cup,
      coalesce((entry ->> 'paidTodayCup')::numeric, 0) as paid_today_cup
    from jsonb_array_elements(public.list_accessible_orders()) entry
  ), active as (
    select * from orders where commercial_status not in ('delivered', 'closed')
  )
  select jsonb_build_object(
    'activeCount', (select count(*) from active),
    'balanceDue', (select coalesce(sum(balance_cup), 0) from active),
    'readyToDeliver', (select count(*) from active where balance_cup <= 0),
    'withBalance', (select count(*) from active where balance_cup > 0),
    'collectedToday', (select coalesce(sum(paid_today_cup), 0) from orders)
  );
$function$;

revoke all on function public.get_order_kpis() from public, anon;
grant execute on function public.get_order_kpis() to authenticated;
