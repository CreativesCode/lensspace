-- QA-61: OpenWA may deliver and then answer 5xx; the Edge Function now records that
-- as failure_code 'provider_unconfirmed'. Show it in the order history as a probable
-- send instead of a plain failure. Only that CASE branch of get_order_timeline changes.
do $migration$
declare
  definition text := pg_get_functiondef('public.get_order_timeline(bigint)'::regprocedure);
  patched text;
begin
  patched := replace(
    definition,
    $$when 'sent' then 'WhatsApp enviado'$$,
    $$when 'sent' then 'WhatsApp enviado'
        when 'failed' then case when attempt.failure_code = 'provider_unconfirmed' then 'WhatsApp enviado sin confirmación del proveedor' else 'Intento de WhatsApp fallido' end$$
  );
  if patched = definition then
    raise exception 'get_order_timeline did not contain the expected notification CASE';
  end if;
  execute patched;
end;
$migration$;
