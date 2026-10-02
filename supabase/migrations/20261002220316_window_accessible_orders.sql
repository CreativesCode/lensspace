-- QA-32: /orders (and every refresh of it) sent the whole order history (~330 B per
-- order). This overload keeps every open order but only finished orders created
-- since `finished_since`. The required parameter avoids PostgREST overload ambiguity;
-- the parameterless version stays for full histories (customer filter).
create or replace function public.list_accessible_orders(finished_since date)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select coalesce(jsonb_agg(entry order by position), '[]'::jsonb)
  from jsonb_array_elements(public.list_accessible_orders()) with ordinality as listed(entry, position)
  where entry ->> 'commercialStatus' not in ('delivered', 'closed')
    or (entry ->> 'createdAt')::timestamptz >= finished_since;
$function$;

revoke all on function public.list_accessible_orders(date) from public, anon;
grant execute on function public.list_accessible_orders(date) to authenticated;
