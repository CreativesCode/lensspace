-- UI 2.0 orders inbox: additive payload fields. Same security invoker functions, so RLS
-- still decides which orders, payments and incidents each caller can see.
create or replace function public.list_accessible_orders()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sale_order.id,
    'orderNumber', sale_order.order_number,
    'customerId', sale_order.customer_id,
    'customerName', customer.full_name,
    'commercialStatus', sale_order.commercial_status,
    'paymentStatus', sale_order.payment_status,
    'totalCup', sale_order.cup_equivalent,
    'createdAt', sale_order.created_at,
    'paidCup', paid.paid_cup,
    'balanceCup', greatest(sale_order.cup_equivalent - paid.paid_cup, 0),
    'paidTodayCup', paid.paid_today_cup,
    'hasOpenIncident', exists (
      select 1
      from public.production_jobs job
      join public.production_incidents incident on incident.job_id = job.id
      where job.order_id = sale_order.id and incident.rework_job_id is null
    )
  ) order by sale_order.created_at desc), '[]'::jsonb)
  from public.orders sale_order
  join public.customers customer on customer.id = sale_order.customer_id
  join public.organizations organization on organization.id = sale_order.organization_id
  cross join lateral (
    select
      coalesce(sum(payment.equivalent_cup), 0) as paid_cup,
      coalesce(sum(payment.equivalent_cup) filter (
        where payment.business_date = (now() at time zone organization.timezone)::date
      ), 0) as paid_today_cup
    from public.payments payment
    where payment.order_id = sale_order.id
  ) paid;
$$;

create or replace function public.get_order_payment_summary(target_order_id bigint)
returns jsonb language plpgsql stable set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'orderId', sale_order.id, 'orderNumber', sale_order.order_number,
    'totalCup', sale_order.cup_equivalent,
    'paidCup', coalesce(sum(payment.equivalent_cup), 0),
    'balanceCup', greatest(sale_order.cup_equivalent - coalesce(sum(payment.equivalent_cup), 0), 0),
    'paymentStatus', sale_order.payment_status,
    'commercialStatus', sale_order.commercial_status,
    'saleRate', sale_order.usd_to_cup_rate,
    'payments', coalesce(jsonb_agg(jsonb_build_object(
      'id', payment.id, 'amount', payment.amount, 'currency', payment.currency,
      'appliedRate', payment.applied_rate, 'equivalentCup', payment.equivalent_cup,
      'receivedAt', payment.received_at, 'isPostClose', payment.is_post_close,
      'notes', payment.notes
    ) order by payment.received_at) filter (where payment.id is not null), '[]'::jsonb)
  ) into result
  from public.orders sale_order left join public.payments payment on payment.order_id = sale_order.id
  where sale_order.id = target_order_id
  group by sale_order.id;
  if result is null then raise exception using errcode = 'P0002', message = 'Pedido no disponible.'; end if;
  return result;
end;
$$;
