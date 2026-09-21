-- Expose the stable customer identifier to authorized order consumers so links
-- from the customer record can filter exactly even when names are duplicated.
create or replace function public.list_accessible_orders()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sale_order.id,
    'orderNumber', sale_order.order_number,
    'customerId', sale_order.customer_id,
    'customerName', customer.full_name,
    'commercialStatus', sale_order.commercial_status,
    'paymentStatus', sale_order.payment_status,
    'totalCup', sale_order.cup_equivalent,
    'createdAt', sale_order.created_at
  ) order by sale_order.created_at desc), '[]'::jsonb)
  from public.orders sale_order
  join public.customers customer on customer.id = sale_order.customer_id;
$$;
