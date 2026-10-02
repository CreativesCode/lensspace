-- QA-01: owners/sellers can record provider stages on the provider's behalf and
-- assign work to an in-house workshop (an active owner/seller of the organization).
-- QA-02: owners who receive cash can close their own cashbox.

create or replace function private.transition_production_job(
  target_job_id bigint,
  target_status text,
  target_notes text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  job public.production_jobs%rowtype;
  actor_role text;
  provider_step boolean;
  optical_step boolean;
  allowed boolean := false;
  event_notes text := nullif(btrim(target_notes), '');
begin
  select * into job from public.production_jobs where id = target_job_id for update;
  if not found or not job.is_current then
    raise exception using errcode = 'P0002', message = 'Trabajo activo no encontrado.';
  end if;
  actor_role := private.production_actor_role(job.organization_id);
  if not private.can_access_production_job(job.organization_id, job.order_id, job.provider_id)
    or not private.can_operate_in_organization(job.organization_id, 'production') then
    raise exception using errcode = '42501', message = 'No puedes actualizar este trabajo.';
  end if;
  if actor_role in ('lens_provider', 'mounting_provider') and job.provider_id <> (select auth.uid()) then
    raise exception using errcode = '42501', message = 'El trabajo no está asignado a este proveedor.';
  end if;

  provider_step := case job.job_type
    when 'lens' then (job.status, target_status) in (
      ('pending', 'in_production'), ('dispatched', 'in_production'), ('in_production', 'completed'))
    when 'mounting' then (job.status, target_status) in (
      ('pending', 'in_mounting'), ('dispatched', 'in_mounting'), ('in_mounting', 'completed'))
    else false
  end;
  optical_step := case job.job_type
    when 'lens' then (job.status, target_status) in (
      ('pending', 'ready_to_send'), ('ready_to_send', 'dispatched'), ('completed', 'received'))
    when 'mounting' then (job.status, target_status) in (
      ('pending', 'ready_to_send'), ('ready_to_send', 'dispatched'), ('completed', 'received'), ('received', 'reviewed'))
    else false
  end;

  if actor_role in ('lens_provider', 'mounting_provider') then
    allowed := provider_step;
  elsif actor_role in ('owner', 'seller') then
    allowed := provider_step or optical_step;
    -- The event keeps the real actor; the note records whose work it was.
    if provider_step and job.provider_id <> (select auth.uid()) then
      event_notes := concat_ws(' · ', 'En nombre de ' || coalesce(
        (select profile.display_name from public.profiles profile where profile.user_id = job.provider_id),
        'el proveedor'), event_notes);
    end if;
  end if;

  if not allowed then
    raise exception using errcode = '42501', message = 'Esta transición no corresponde a tu rol o al estado actual del trabajo.';
  end if;

  update public.production_jobs set status = target_status,
    dispatched_at = case when target_status = 'dispatched' then now() else dispatched_at end,
    completed_at = case when target_status = 'completed' then now() else completed_at end,
    received_at = case when target_status in ('received', 'reviewed') then coalesce(received_at, now()) else received_at end
  where id = job.id;
  insert into public.production_job_events (
    job_id, organization_id, branch_id, from_status, to_status, actor_id, actor_role, notes
  ) values (
    job.id, job.organization_id, job.branch_id, job.status, target_status,
    (select auth.uid()), actor_role, event_notes
  );
end;
$$;

create or replace function private.assign_production_job(
  target_order_id bigint,
  target_job_type text,
  target_provider_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  sale_order public.orders%rowtype;
  provider_role text;
  actor_role text;
  created_job_id bigint;
  snapshot jsonb;
begin
  if target_job_type not in ('lens', 'mounting') then
    raise exception using errcode = '22023', message = 'Tipo de trabajo no válido.';
  end if;
  select * into sale_order from public.orders where id = target_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Pedido no encontrado.'; end if;
  actor_role := private.production_actor_role(sale_order.organization_id);
  if actor_role not in ('owner', 'seller')
    or (actor_role = 'seller' and sale_order.primary_seller_id <> (select auth.uid()))
    or not private.can_operate_in_organization(sale_order.organization_id, 'production') then
    raise exception using errcode = '42501', message = 'No puedes asignar producción para este pedido.';
  end if;
  provider_role := case when target_job_type = 'lens' then 'lens_provider' else 'mounting_provider' end;
  -- An active owner/seller of the organization is a valid in-house workshop.
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = sale_order.organization_id
      and membership.user_id = target_provider_id
      and membership.role in (provider_role, 'owner', 'seller') and membership.status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'El responsable no está activo en la organización con un rol válido para este trabajo.';
  end if;
  if exists (select 1 from public.production_jobs where order_id = sale_order.id and job_type = target_job_type and is_current) then
    raise exception using errcode = '23505', message = 'El pedido ya tiene un trabajo activo de ese tipo.';
  end if;

  select jsonb_build_object(
    'orderNumber', sale_order.order_number,
    'jobType', target_job_type,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'category', item.category, 'name', item.name, 'position', item.position
    ) order by item.position) from public.order_items item where item.order_id = sale_order.id), '[]'::jsonb),
    'prescription', (select to_jsonb(revision) - array['created_by', 'change_reason', 'notes']
      from public.prescription_revisions revision where revision.id = sale_order.prescription_revision_id)
  ) into snapshot;

  insert into public.production_jobs (
    order_id, organization_id, branch_id, job_type, provider_id, work_snapshot, assigned_by
  ) values (
    sale_order.id, sale_order.organization_id, sale_order.branch_id, target_job_type,
    target_provider_id, snapshot, (select auth.uid())
  ) returning id into created_job_id;
  insert into public.production_job_events (
    job_id, organization_id, branch_id, from_status, to_status, actor_id, actor_role, notes
  ) values (
    created_job_id, sale_order.organization_id, sale_order.branch_id, null, 'pending',
    (select auth.uid()), actor_role, 'Trabajo asignado.'
  );
  return created_job_id;
end;
$$;

create or replace function private.close_seller_cashbox(
  target_cashbox_id bigint,
  target_closure_type text,
  target_declared_amount numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_cashbox public.seller_cashboxes%rowtype;
  next_sequence integer;
  target_expected numeric(14,2);
  created_closure_id bigint;
  allocated_count integer;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;
  if target_closure_type not in ('primary', 'complementary') then
    raise exception using errcode = '22023', message = 'Tipo de cierre no válido.';
  end if;
  if target_declared_amount is null or target_declared_amount < 0 then
    raise exception using errcode = '22023', message = 'El importe declarado no es válido.';
  end if;

  select * into target_cashbox from public.seller_cashboxes
  where id = target_cashbox_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Caja no encontrada.'; end if;
  if target_cashbox.seller_id <> (select auth.uid())
    or not private.has_organization_role(target_cashbox.organization_id, array['seller', 'owner'])
    or not private.can_operate_in_organization(target_cashbox.organization_id, 'cashbox') then
    raise exception using errcode = '42501', message = 'Solo quien recibió el efectivo puede cerrar su propia caja.';
  end if;

  if target_closure_type = 'primary' then
    if exists (select 1 from public.cashbox_closures where cashbox_id = target_cashbox.id and closure_type = 'primary') then
      raise exception using errcode = '23505', message = 'La caja ya tiene un cierre principal.';
    end if;
    next_sequence := 0;
  else
    if not exists (select 1 from public.cashbox_closures where cashbox_id = target_cashbox.id and closure_type = 'primary') then
      raise exception using errcode = '55000', message = 'Primero debes crear el cierre principal.';
    end if;
    select coalesce(max(sequence_number), 0) + 1 into next_sequence
    from public.cashbox_closures where cashbox_id = target_cashbox.id;
  end if;

  perform payment.id
  from public.payments payment
  left join public.cashbox_closure_payments allocation on allocation.payment_id = payment.id
  where payment.cashbox_id = target_cashbox.id
    and allocation.payment_id is null
    and (target_closure_type = 'primary' or payment.is_post_close)
  order by payment.id
  for update of payment;

  select coalesce(sum(payment.amount), 0), count(payment.id)::integer
  into target_expected, allocated_count
  from public.payments payment
  left join public.cashbox_closure_payments allocation on allocation.payment_id = payment.id
  where payment.cashbox_id = target_cashbox.id
    and allocation.payment_id is null
    and (target_closure_type = 'primary' or payment.is_post_close);

  if target_closure_type = 'complementary' and allocated_count = 0 then
    raise exception using errcode = '55000', message = 'No hay pagos posteriores pendientes de cierre.';
  end if;

  insert into public.cashbox_closures (
    cashbox_id, organization_id, branch_id, seller_id, business_date, currency,
    closure_type, sequence_number, expected_amount, declared_amount, closed_by
  ) values (
    target_cashbox.id, target_cashbox.organization_id, target_cashbox.branch_id,
    target_cashbox.seller_id, target_cashbox.business_date, target_cashbox.currency,
    target_closure_type, next_sequence, target_expected, round(target_declared_amount, 2), (select auth.uid())
  ) returning id into created_closure_id;

  insert into public.cashbox_closure_payments (closure_id, payment_id, allocated_amount)
  select created_closure_id, payment.id, payment.amount
  from public.payments payment
  left join public.cashbox_closure_payments allocation on allocation.payment_id = payment.id
  where payment.cashbox_id = target_cashbox.id
    and allocation.payment_id is null
    and (target_closure_type = 'primary' or payment.is_post_close)
  order by payment.id;

  return jsonb_build_object(
    'closureId', created_closure_id,
    'sequenceNumber', next_sequence,
    'expectedAmount', target_expected,
    'declaredAmount', round(target_declared_amount, 2),
    'differenceAmount', round(target_declared_amount, 2) - target_expected,
    'paymentCount', allocated_count
  );
end;
$$;
