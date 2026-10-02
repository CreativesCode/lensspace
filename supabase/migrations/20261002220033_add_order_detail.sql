-- QA-35: opening an order made 2 RPCs (+2 CORS preflights) on slow links. One call
-- returns both; a timeline failure still returns the summary (as before).
create or replace function public.get_order_detail(target_order_id bigint)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  history jsonb;
begin
  begin
    history := public.get_order_timeline(target_order_id);
  exception when others then
    history := '[]'::jsonb;
  end;
  return jsonb_build_object(
    'summary', public.get_order_payment_summary(target_order_id),
    'timeline', coalesce(history, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_order_detail(bigint) from public, anon;
grant execute on function public.get_order_detail(bigint) to authenticated;
