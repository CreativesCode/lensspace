-- Counter allocation is available only through private.next_order_number().
create policy order_counters_deny_direct_access
on public.order_counters for all to authenticated
using (false)
with check (false);
