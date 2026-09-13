-- Phase 7: platform tenant controls, auditable assisted access and pilot usage.

create table public.platform_support_sessions (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete restrict,
  administrator_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  check (expires_at > started_at and expires_at <= started_at + interval '2 hours'),
  check (ended_at is null or ended_at >= started_at)
);

create unique index platform_support_sessions_one_active_admin_idx
  on public.platform_support_sessions (administrator_id) where ended_at is null;
create index platform_support_sessions_organization_time_idx
  on public.platform_support_sessions (organization_id, started_at desc);
create index platform_support_sessions_active_expiry_idx
  on public.platform_support_sessions (expires_at) where ended_at is null;

alter table public.platform_support_sessions enable row level security;

create policy platform_support_sessions_select_admin
on public.platform_support_sessions for select to authenticated
using ((select private.is_platform_admin()));
create policy platform_support_sessions_insert_admin
on public.platform_support_sessions for insert to authenticated
with check (
  administrator_id = (select auth.uid())
  and (select private.is_platform_admin())
);
create policy platform_support_sessions_update_admin
on public.platform_support_sessions for update to authenticated
using (
  administrator_id = (select auth.uid())
  and (select private.is_platform_admin())
)
with check (
  administrator_id = (select auth.uid())
  and (select private.is_platform_admin())
);

revoke all on public.platform_support_sessions from public, anon, authenticated;
grant select, insert on public.platform_support_sessions to authenticated;
grant update (ended_at) on public.platform_support_sessions to authenticated;
grant usage, select on sequence public.platform_support_sessions_id_seq to authenticated;

create or replace function private.write_platform_audit(
  target_organization_id bigint,
  target_event_type text,
  target_entity_type text,
  target_entity_id text,
  target_reason text,
  target_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo un administrador de plataforma puede registrar esta acción.';
  end if;
  insert into public.audit_events (
    organization_id, actor_user_id, event_type, entity_type, entity_id, origin, reason, payload
  ) values (
    target_organization_id, (select auth.uid()), target_event_type, target_entity_type,
    target_entity_id, 'support', nullif(btrim(target_reason), ''), coalesce(target_payload, '{}'::jsonb)
  );
end;
$$;

revoke all on function private.write_platform_audit(bigint, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function private.write_platform_audit(bigint, text, text, text, text, jsonb)
  to authenticated;

create or replace function public.update_platform_organization(
  target_organization_id bigint,
  target_organization_status text,
  target_subscription_status text,
  target_amount numeric,
  target_currency text,
  target_billing_period text,
  target_starts_on date,
  target_expires_on date,
  target_module_keys text[],
  change_reason text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare requested text[] := coalesce(target_module_keys, array[]::text[]);
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede cambiar el contrato.';
  end if;
  if char_length(btrim(change_reason)) < 10 then
    raise exception using errcode = '22023', message = 'Explica el motivo del cambio (mínimo 10 caracteres).';
  end if;
  if target_organization_status not in ('active', 'suspended', 'archived')
    or target_subscription_status not in ('trial', 'active', 'expired', 'suspended')
    or target_amount < 0
    or upper(target_currency) !~ '^[A-Z]{3}$'
    or target_billing_period not in ('monthly', 'quarterly', 'semiannual', 'annual', 'custom')
    or target_expires_on < target_starts_on then
    raise exception using errcode = '22023', message = 'La configuración del contrato es inválida.';
  end if;
  if 'core' = any(requested) or exists (
    select 1 from unnest(requested) requested_key
    where not exists (select 1 from public.modules module where module.key = requested_key and module.is_active)
  ) then
    raise exception using errcode = '22023', message = 'La selección contiene módulos opcionales inválidos.';
  end if;
  if exists (
    select 1 from public.module_dependencies dependency
    where dependency.module_key = any(requested)
      and dependency.depends_on_module_key <> 'core'
      and not dependency.depends_on_module_key = any(requested)
  ) then
    raise exception using errcode = '23514', message = 'Faltan dependencias de módulos seleccionados.';
  end if;

  update public.organization_modules
  set is_enabled = false, changed_at = now(), changed_by = (select auth.uid())
  where organization_id = target_organization_id
    and module_key in ('cashbox', 'production', 'whatsapp')
    and not module_key = any(requested) and is_enabled;
  update public.organization_modules
  set is_enabled = false, changed_at = now(), changed_by = (select auth.uid())
  where organization_id = target_organization_id
    and module_key in ('analytics', 'multi_branch')
    and not module_key = any(requested) and is_enabled;
  update public.organization_modules
  set is_enabled = false, changed_at = now(), changed_by = (select auth.uid())
  where organization_id = target_organization_id
    and module_key = 'optical_sales' and not module_key = any(requested) and is_enabled;

  insert into public.organization_modules (organization_id, module_key, is_enabled, changed_by)
  select target_organization_id, requested_key, true, (select auth.uid())
  from unnest(requested) requested_key
  order by case requested_key when 'optical_sales' then 1 when 'multi_branch' then 2 else 3 end
  on conflict (organization_id, module_key) do update set
    is_enabled = true, changed_at = now(), changed_by = excluded.changed_by;

  update public.organizations
  set status = target_organization_status, updated_at = now()
  where id = target_organization_id;
  if not found then raise exception using errcode = 'P0002', message = 'Organización no encontrada.'; end if;

  update public.subscriptions set
    status = target_subscription_status,
    amount = target_amount,
    currency = upper(target_currency),
    billing_period = target_billing_period,
    starts_on = target_starts_on,
    expires_on = target_expires_on,
    last_renewed_on = case when target_subscription_status = 'active' then current_date else last_renewed_on end,
    updated_at = now()
  where organization_id = target_organization_id;

  perform private.write_platform_audit(
    target_organization_id, 'organization.contract_changed', 'organization',
    target_organization_id::text, change_reason,
    jsonb_build_object(
      'organizationStatus', target_organization_status,
      'subscriptionStatus', target_subscription_status,
      'amount', target_amount,
      'currency', upper(target_currency),
      'billingPeriod', target_billing_period,
      'startsOn', target_starts_on,
      'expiresOn', target_expires_on,
      'modules', requested
    )
  );
  return jsonb_build_object('organizationId', target_organization_id, 'updated', true);
end;
$$;

create or replace function public.begin_platform_support_session(
  target_organization_id bigint,
  support_reason text,
  duration_minutes integer default 30
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare new_session public.platform_support_sessions%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede iniciar asistencia.';
  end if;
  if duration_minutes not between 5 and 120 then
    raise exception using errcode = '22023', message = 'La asistencia debe durar entre 5 y 120 minutos.';
  end if;
  update public.platform_support_sessions set ended_at = now()
  where administrator_id = (select auth.uid()) and ended_at is null;
  insert into public.platform_support_sessions (
    organization_id, administrator_id, reason, expires_at
  ) values (
    target_organization_id, (select auth.uid()), btrim(support_reason), now() + make_interval(mins => duration_minutes)
  ) returning * into new_session;
  perform private.write_platform_audit(
    target_organization_id, 'support.session_started', 'platform_support_session',
    new_session.id::text, support_reason,
    jsonb_build_object('expiresAt', new_session.expires_at)
  );
  return jsonb_build_object('sessionId', new_session.id, 'expiresAt', new_session.expires_at);
end;
$$;

create or replace function public.end_platform_support_session(target_session_id bigint)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare target_session public.platform_support_sessions%rowtype;
begin
  update public.platform_support_sessions set ended_at = now()
  where id = target_session_id and administrator_id = (select auth.uid()) and ended_at is null
  returning * into target_session;
  if not found then return false; end if;
  perform private.write_platform_audit(
    target_session.organization_id, 'support.session_ended', 'platform_support_session',
    target_session.id::text, target_session.reason,
    jsonb_build_object('endedAt', target_session.ended_at)
  );
  return true;
end;
$$;

create or replace function public.get_platform_usage()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede consultar uso.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'organizationId', organization.id,
    'customers', (select count(*) from public.customers customer where customer.organization_id = organization.id),
    'orders', (select count(*) from public.orders sale_order where sale_order.organization_id = organization.id),
    'members', (select count(*) from public.organization_memberships membership where membership.organization_id = organization.id and membership.status = 'active'),
    'openProductionJobs', (select count(*) from public.production_jobs job where job.organization_id = organization.id and job.is_current and job.status not in ('received', 'reviewed')),
    'notificationAttempts', (select count(*) from public.notification_attempts attempt where attempt.organization_id = organization.id),
    'lastActivityAt', (select max(activity_time) from (values
      ((select max(sale_order.created_at) from public.orders sale_order where sale_order.organization_id = organization.id)),
      ((select max(payment.received_at) from public.payments payment where payment.organization_id = organization.id)),
      ((select max(event.occurred_at) from public.production_job_events event where event.organization_id = organization.id))
    ) activity(activity_time))
  ) order by organization.created_at desc), '[]'::jsonb)
  into result from public.organizations organization;
  return result;
end;
$$;

revoke all on function public.update_platform_organization(bigint, text, text, numeric, text, text, date, date, text[], text),
  public.begin_platform_support_session(bigint, text, integer),
  public.end_platform_support_session(bigint), public.get_platform_usage()
from public, anon;
grant execute on function public.update_platform_organization(bigint, text, text, numeric, text, text, date, date, text[], text),
  public.begin_platform_support_session(bigint, text, integer),
  public.end_platform_support_session(bigint), public.get_platform_usage()
to authenticated;
