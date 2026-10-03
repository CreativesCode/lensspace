-- QA-41: BUSINESS_LOGIC says reworks can be reassigned. The rework may go to another
-- responsible person, validated exactly like an assignment (active provider of the job
-- type, or an active owner/seller as in-house workshop). NULL keeps the original one.

create or replace function private.create_production_rework(target_incident_id bigint, new_provider_id uuid)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  incident public.production_incidents%rowtype;
  original public.production_jobs%rowtype;
  actor_role text;
  rework_id bigint;
  rework_provider_id uuid;
begin
  select * into incident from public.production_incidents where id = target_incident_id for update;
  if not found or incident.rework_job_id is not null then raise exception using errcode = '55000', message = 'Incidencia no disponible para repetición.'; end if;
  select * into original from public.production_jobs where id = incident.job_id for update;
  actor_role := private.production_actor_role(original.organization_id);
  if actor_role not in ('owner', 'seller')
    or (actor_role = 'seller' and not exists (select 1 from public.orders where id = original.order_id and primary_seller_id = (select auth.uid())))
    or not private.can_operate_in_organization(original.organization_id, 'production') then
    raise exception using errcode = '42501', message = 'No puedes autorizar esta repetición.';
  end if;
  rework_provider_id := coalesce(new_provider_id, original.provider_id);
  if rework_provider_id <> original.provider_id and not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = original.organization_id
      and membership.user_id = rework_provider_id
      and membership.role in (case when original.job_type = 'lens' then 'lens_provider' else 'mounting_provider' end, 'owner', 'seller')
      and membership.status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'El responsable no está activo en la organización con un rol válido para este trabajo.';
  end if;
  update public.production_jobs set is_current = false, superseded_at = now() where id = original.id;
  insert into public.production_jobs (
    order_id, organization_id, branch_id, job_type, provider_id, status,
    work_snapshot, original_job_id, assigned_by
  ) values (
    original.order_id, original.organization_id, original.branch_id, original.job_type,
    rework_provider_id, 'pending', original.work_snapshot, original.id, (select auth.uid())
  ) returning id into rework_id;
  update public.production_incidents set rework_job_id = rework_id where id = incident.id;
  insert into public.production_job_events (
    job_id, organization_id, branch_id, from_status, to_status, actor_id, actor_role, notes
  ) values (
    rework_id, original.organization_id, original.branch_id, null, 'pending',
    (select auth.uid()), actor_role,
    case when rework_provider_id = original.provider_id then 'Repetición vinculada a incidencia.' else 'Repetición vinculada a incidencia y reasignada.' end
  );
  return rework_id;
end;
$function$;

revoke all on function private.create_production_rework(bigint, uuid) from public, anon;
grant execute on function private.create_production_rework(bigint, uuid) to authenticated;

create or replace function private.create_production_rework(target_incident_id bigint)
returns bigint
language sql
security definer
set search_path to ''
as $function$
  select private.create_production_rework(target_incident_id, null::uuid);
$function$;

-- The new responsible parameter is required here so PostgREST never sees two
-- matching overloads for a call without it.
create or replace function public.create_production_rework(target_incident_id bigint, new_provider_id uuid)
returns bigint
language sql
set search_path to ''
as $function$
  select private.create_production_rework(target_incident_id, new_provider_id);
$function$;

revoke all on function public.create_production_rework(bigint, uuid) from public, anon;
grant execute on function public.create_production_rework(bigint, uuid) to authenticated;
