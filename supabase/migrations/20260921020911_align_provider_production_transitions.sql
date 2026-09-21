create or replace function private.transition_production_job(
  target_job_id bigint,
  target_status text,
  target_notes text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  job public.production_jobs%rowtype;
  actor_role text;
  allowed boolean := false;
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

  if actor_role in ('lens_provider', 'mounting_provider') then
    allowed := case job.job_type
      when 'lens' then (job.status, target_status) in (
        ('pending', 'in_production'),
        ('dispatched', 'in_production'),
        ('in_production', 'completed')
      )
      when 'mounting' then (job.status, target_status) in (
        ('pending', 'in_mounting'),
        ('dispatched', 'in_mounting'),
        ('in_mounting', 'completed')
      )
      else false
    end;
  elsif actor_role in ('owner', 'seller') then
    allowed := case job.job_type
      when 'lens' then (job.status, target_status) in (
        ('pending', 'ready_to_send'),
        ('ready_to_send', 'dispatched'),
        ('completed', 'received')
      )
      when 'mounting' then (job.status, target_status) in (
        ('pending', 'ready_to_send'),
        ('ready_to_send', 'dispatched'),
        ('completed', 'received'),
        ('received', 'reviewed')
      )
      else false
    end;
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
    (select auth.uid()), actor_role, nullif(btrim(target_notes), '')
  );
end;
$$;
