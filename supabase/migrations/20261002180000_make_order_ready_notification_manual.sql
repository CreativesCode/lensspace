-- QA-08 (product decision 2026-10-02): "Pedido listo" is sent only when the seller
-- decides. The automatic trigger fired on the first lens reception (before mounting
-- or review) and its per-order key blocked the legitimate notice after a rework.

drop trigger production_events_notify_order_ready on public.production_job_events;
drop function private.notify_order_ready();

-- One dispatch per click: the client sends one request id per attempt and reuses it
-- on retry, so a lost response never sends the message twice, while a later click
-- (e.g. after a rework) sends a new notice.
create function public.notify_order_ready(target_order_id bigint, request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  sale_order public.orders%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;
  if request_id is null then
    raise exception using errcode = '22023', message = 'Solicitud de aviso no válida.';
  end if;
  select * into sale_order from public.orders where id = target_order_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido no encontrado.';
  end if;
  if not private.can_write_seller_sale(sale_order.organization_id, sale_order.branch_id, sale_order.primary_seller_id)
    or not private.can_operate_in_organization(sale_order.organization_id, 'whatsapp') then
    raise exception using errcode = '42501', message = 'No puedes avisar al cliente de este pedido.';
  end if;
  if sale_order.commercial_status <> 'accepted' then
    raise exception using errcode = '55000', message = 'El pedido ya fue entregado.';
  end if;

  perform private.queue_openwa_notification(
    sale_order.id, 'order_ready', (select auth.uid()),
    'order_ready:' || sale_order.id || ':' || request_id
  );
  return jsonb_build_object('queued', true);
end;
$$;

revoke all on function public.notify_order_ready(bigint, uuid) from public, anon;
grant execute on function public.notify_order_ready(bigint, uuid) to authenticated, service_role;
