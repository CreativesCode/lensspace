-- Provider-scoped production jobs, state history, incidents and linked rework.
create table public.production_jobs (
  id bigint generated always as identity primary key,
  order_id bigint not null,
  organization_id bigint not null references public.organizations(id),
  branch_id bigint not null,
  job_type text not null check (job_type in ('lens', 'mounting')),
  provider_id uuid not null references auth.users(id),
  status text not null default 'pending' check (status in (
    'pending', 'ready_to_send', 'dispatched', 'in_production', 'in_mounting',
    'completed', 'received', 'reviewed', 'incident'
  )),
  work_snapshot jsonb not null check (jsonb_typeof(work_snapshot) = 'object'),
  original_job_id bigint references public.production_jobs(id),
  is_current boolean not null default true,
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  dispatched_at timestamptz,
  completed_at timestamptz,
  received_at timestamptz,
  superseded_at timestamptz,
  unique (id, organization_id, branch_id),
  foreign key (order_id, organization_id, branch_id)
    references public.orders(id, organization_id, branch_id),
  check ((is_current and superseded_at is null) or (not is_current and superseded_at is not null)),
  check (original_job_id is null or original_job_id <> id)
);

create unique index production_jobs_one_current_type_idx
  on public.production_jobs (order_id, job_type) where is_current;
create index production_jobs_provider_status_idx
  on public.production_jobs (provider_id, status, assigned_at desc) where is_current;
create index production_jobs_organization_status_idx
  on public.production_jobs (organization_id, branch_id, status, assigned_at desc);
create index production_jobs_order_fk_idx on public.production_jobs (order_id, organization_id, branch_id);
create index production_jobs_branch_fk_idx on public.production_jobs (branch_id);
create index production_jobs_original_fk_idx on public.production_jobs (original_job_id) where original_job_id is not null;
create index production_jobs_assigned_by_fk_idx on public.production_jobs (assigned_by);

create table public.production_job_events (
  id bigint generated always as identity primary key,
  job_id bigint not null,
  organization_id bigint not null,
  branch_id bigint not null,
  from_status text,
  to_status text not null,
  actor_id uuid not null references auth.users(id),
  actor_role text not null check (actor_role in ('owner', 'seller', 'lens_provider', 'mounting_provider')),
  notes text check (notes is null or char_length(notes) <= 1000),
  occurred_at timestamptz not null default now(),
  foreign key (job_id, organization_id, branch_id)
    references public.production_jobs(id, organization_id, branch_id)
);

create index production_job_events_job_time_idx on public.production_job_events (job_id, occurred_at, id);
create index production_job_events_organization_time_idx on public.production_job_events (organization_id, occurred_at desc);
create index production_job_events_branch_fk_idx on public.production_job_events (branch_id);
create index production_job_events_actor_fk_idx on public.production_job_events (actor_id);

create table public.production_incidents (
  id bigint generated always as identity primary key,
  job_id bigint not null,
  organization_id bigint not null,
  branch_id bigint not null,
  description text not null check (char_length(btrim(description)) between 5 and 2000),
  cost_responsibility text not null check (cost_responsibility in (
    'organization', 'lens_provider', 'mounting_provider', 'customer'
  )),
  opened_by uuid not null references auth.users(id),
  opened_at timestamptz not null default now(),
  rework_job_id bigint references public.production_jobs(id),
  foreign key (job_id, organization_id, branch_id)
    references public.production_jobs(id, organization_id, branch_id),
  check (rework_job_id is null or rework_job_id <> job_id)
);

create index production_incidents_job_time_idx on public.production_incidents (job_id, opened_at desc);
create index production_incidents_organization_time_idx on public.production_incidents (organization_id, opened_at desc);
create index production_incidents_branch_fk_idx on public.production_incidents (branch_id);
create index production_incidents_actor_fk_idx on public.production_incidents (opened_by);
create index production_incidents_rework_fk_idx on public.production_incidents (rework_job_id) where rework_job_id is not null;

create or replace function private.can_access_production_job(
  target_organization_id bigint,
  target_order_id bigint,
  target_provider_id uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    private.has_organization_role(target_organization_id, array['owner'])
    or target_provider_id = (select auth.uid())
    or exists (
      select 1 from public.orders sale_order
      where sale_order.id = target_order_id
        and sale_order.organization_id = target_organization_id
        and sale_order.primary_seller_id = (select auth.uid())
    )
  );
$$;

create or replace function private.production_actor_role(target_organization_id bigint)
returns text language sql stable security definer set search_path = '' as $$
  select membership.role from public.organization_memberships membership
  where membership.organization_id = target_organization_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
  order by case membership.role when 'owner' then 1 when 'seller' then 2 else 3 end
  limit 1;
$$;

create or replace function private.reject_production_history_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'El historial de produccion es inmutable.';
end;
$$;

create or replace function private.guard_production_incident_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
    and current_user = 'postgres'
    and old.rework_job_id is null
    and new.rework_job_id is not null
    and (to_jsonb(new) - 'rework_job_id') = (to_jsonb(old) - 'rework_job_id') then
    return new;
  end if;
  raise exception using errcode = '55000', message = 'El historial de incidencias es inmutable.';
end;
$$;

create trigger production_job_events_immutable before update or delete on public.production_job_events
for each row execute function private.reject_production_history_change();
create trigger production_incidents_immutable before update or delete on public.production_incidents
for each row execute function private.guard_production_incident_change();

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
    raise exception using errcode = '22023', message = 'Tipo de trabajo no valido.';
  end if;
  select * into sale_order from public.orders where id = target_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Pedido no encontrado.'; end if;
  actor_role := private.production_actor_role(sale_order.organization_id);
  if actor_role not in ('owner', 'seller')
    or (actor_role = 'seller' and sale_order.primary_seller_id <> (select auth.uid()))
    or not private.can_operate_in_organization(sale_order.organization_id, 'production') then
    raise exception using errcode = '42501', message = 'No puedes asignar produccion para este pedido.';
  end if;
  provider_role := case when target_job_type = 'lens' then 'lens_provider' else 'mounting_provider' end;
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = sale_order.organization_id
      and membership.user_id = target_provider_id
      and membership.role = provider_role and membership.status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'El proveedor no esta activo con el rol requerido en la organizacion.';
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
  if not found or not job.is_current then raise exception using errcode = 'P0002', message = 'Trabajo activo no encontrado.'; end if;
  actor_role := private.production_actor_role(job.organization_id);
  if not private.can_access_production_job(job.organization_id, job.order_id, job.provider_id)
    or not private.can_operate_in_organization(job.organization_id, 'production') then
    raise exception using errcode = '42501', message = 'No puedes actualizar este trabajo.';
  end if;
  if actor_role in ('lens_provider', 'mounting_provider') and job.provider_id <> (select auth.uid()) then
    raise exception using errcode = '42501', message = 'El trabajo no esta asignado a este proveedor.';
  end if;

  allowed := case job.job_type
    when 'lens' then (job.status, target_status) in (
      ('pending', 'ready_to_send'), ('ready_to_send', 'dispatched'),
      ('dispatched', 'in_production'), ('in_production', 'completed'),
      ('completed', 'received')
    )
    when 'mounting' then (job.status, target_status) in (
      ('pending', 'ready_to_send'), ('ready_to_send', 'dispatched'),
      ('dispatched', 'in_mounting'), ('in_mounting', 'completed'),
      ('completed', 'received'), ('received', 'reviewed')
    ) else false end;
  if not allowed then raise exception using errcode = '23514', message = 'Transicion de produccion no permitida.'; end if;
  if actor_role in ('lens_provider', 'mounting_provider') and target_status in ('ready_to_send', 'dispatched', 'received', 'reviewed') then
    raise exception using errcode = '42501', message = 'Esta transicion corresponde a la optica.';
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

create or replace function private.report_production_incident(
  target_job_id bigint,
  target_description text,
  target_cost_responsibility text
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  job public.production_jobs%rowtype;
  actor_role text;
  incident_id bigint;
begin
  select * into job from public.production_jobs where id = target_job_id for update;
  if not found or not job.is_current then raise exception using errcode = 'P0002', message = 'Trabajo activo no encontrado.'; end if;
  actor_role := private.production_actor_role(job.organization_id);
  if not private.can_access_production_job(job.organization_id, job.order_id, job.provider_id)
    or not private.can_operate_in_organization(job.organization_id, 'production') then
    raise exception using errcode = '42501', message = 'No puedes reportar esta incidencia.';
  end if;
  if target_cost_responsibility not in ('organization', 'lens_provider', 'mounting_provider', 'customer') then
    raise exception using errcode = '22023', message = 'Responsabilidad de costo no valida.';
  end if;
  insert into public.production_incidents (
    job_id, organization_id, branch_id, description, cost_responsibility, opened_by
  ) values (
    job.id, job.organization_id, job.branch_id, btrim(target_description), target_cost_responsibility, (select auth.uid())
  ) returning id into incident_id;
  update public.production_jobs set status = 'incident' where id = job.id;
  insert into public.production_job_events (
    job_id, organization_id, branch_id, from_status, to_status, actor_id, actor_role, notes
  ) values (
    job.id, job.organization_id, job.branch_id, job.status, 'incident',
    (select auth.uid()), actor_role, btrim(target_description)
  );
  return incident_id;
end;
$$;

create or replace function private.create_production_rework(target_incident_id bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  incident public.production_incidents%rowtype;
  original public.production_jobs%rowtype;
  actor_role text;
  rework_id bigint;
begin
  select * into incident from public.production_incidents where id = target_incident_id for update;
  if not found or incident.rework_job_id is not null then raise exception using errcode = '55000', message = 'Incidencia no disponible para repeticion.'; end if;
  select * into original from public.production_jobs where id = incident.job_id for update;
  actor_role := private.production_actor_role(original.organization_id);
  if actor_role not in ('owner', 'seller')
    or (actor_role = 'seller' and not exists (select 1 from public.orders where id = original.order_id and primary_seller_id = (select auth.uid())))
    or not private.can_operate_in_organization(original.organization_id, 'production') then
    raise exception using errcode = '42501', message = 'No puedes autorizar esta repeticion.';
  end if;
  update public.production_jobs set is_current = false, superseded_at = now() where id = original.id;
  insert into public.production_jobs (
    order_id, organization_id, branch_id, job_type, provider_id, status,
    work_snapshot, original_job_id, assigned_by
  ) values (
    original.order_id, original.organization_id, original.branch_id, original.job_type,
    original.provider_id, 'pending', original.work_snapshot, original.id, (select auth.uid())
  ) returning id into rework_id;
  update public.production_incidents set rework_job_id = rework_id where id = incident.id;
  insert into public.production_job_events (
    job_id, organization_id, branch_id, from_status, to_status, actor_id, actor_role, notes
  ) values (
    rework_id, original.organization_id, original.branch_id, null, 'pending',
    (select auth.uid()), actor_role, 'Repeticion vinculada a incidencia.'
  );
  return rework_id;
end;
$$;

alter table public.production_jobs enable row level security;
alter table public.production_job_events enable row level security;
alter table public.production_incidents enable row level security;
create policy production_jobs_select on public.production_jobs for select to authenticated
using ((select private.can_access_production_job(organization_id, order_id, provider_id)));
create policy production_job_events_select on public.production_job_events for select to authenticated
using (exists (select 1 from public.production_jobs job where job.id = job_id));
create policy production_incidents_select on public.production_incidents for select to authenticated
using (exists (select 1 from public.production_jobs job where job.id = job_id));

revoke all on public.production_jobs, public.production_job_events, public.production_incidents from anon, authenticated;
grant select on public.production_jobs, public.production_job_events, public.production_incidents to authenticated;
revoke all on function private.can_access_production_job(bigint, bigint, uuid), private.production_actor_role(bigint),
  private.assign_production_job(bigint, text, uuid), private.transition_production_job(bigint, text, text),
  private.report_production_incident(bigint, text, text), private.create_production_rework(bigint)
from public, anon;
grant execute on function private.assign_production_job(bigint, text, uuid),
  private.transition_production_job(bigint, text, text), private.report_production_incident(bigint, text, text),
  private.create_production_rework(bigint) to authenticated;
grant execute on function private.can_access_production_job(bigint, bigint, uuid) to authenticated;

create or replace function public.assign_production_job(target_order_id bigint, job_type text, provider_id uuid)
returns bigint language sql security invoker set search_path = '' as $$
  select private.assign_production_job(target_order_id, job_type, provider_id);
$$;
create or replace function public.transition_production_job(target_job_id bigint, target_status text, notes text default null)
returns void language sql security invoker set search_path = '' as $$
  select private.transition_production_job(target_job_id, target_status, notes);
$$;
create or replace function public.report_production_incident(target_job_id bigint, description text, cost_responsibility text)
returns bigint language sql security invoker set search_path = '' as $$
  select private.report_production_incident(target_job_id, description, cost_responsibility);
$$;
create or replace function public.create_production_rework(target_incident_id bigint)
returns bigint language sql security invoker set search_path = '' as $$
  select private.create_production_rework(target_incident_id);
$$;

create or replace function public.list_accessible_production_jobs()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', job.id, 'orderId', job.order_id, 'orderNumber', job.work_snapshot ->> 'orderNumber',
    'jobType', job.job_type, 'providerId', job.provider_id,
    'providerName', provider.display_name, 'status', job.status,
    'snapshot', job.work_snapshot, 'originalJobId', job.original_job_id,
    'assignedAt', job.assigned_at, 'dispatchedAt', job.dispatched_at,
    'completedAt', job.completed_at, 'receivedAt', job.received_at,
    'incidents', coalesce((select jsonb_agg(jsonb_build_object(
      'id', incident.id, 'description', incident.description,
      'costResponsibility', incident.cost_responsibility, 'openedAt', incident.opened_at,
      'reworkJobId', incident.rework_job_id
    ) order by incident.opened_at) from public.production_incidents incident where incident.job_id = job.id), '[]'::jsonb)
  ) order by job.assigned_at desc), '[]'::jsonb)
  from public.production_jobs job
  join public.profiles provider on provider.user_id = job.provider_id;
$$;

revoke all on function public.assign_production_job(bigint, text, uuid),
  public.transition_production_job(bigint, text, text), public.report_production_incident(bigint, text, text),
  public.create_production_rework(bigint), public.list_accessible_production_jobs() from public, anon;
grant execute on function public.assign_production_job(bigint, text, uuid),
  public.transition_production_job(bigint, text, text), public.report_production_incident(bigint, text, text),
  public.create_production_rework(bigint), public.list_accessible_production_jobs() to authenticated;
