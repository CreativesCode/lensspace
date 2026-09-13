-- Vision Studio core multi-tenant foundation.
-- All authorization data is database-backed; user-editable auth metadata is not trusted.

create schema if not exists private;
revoke all on schema private from public, anon;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete restrict
);

create table public.organizations (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  order_prefix text not null check (order_prefix ~ '^[A-Z0-9]{3,8}$'),
  timezone text not null default 'America/Havana',
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  first_order_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_prefix)
);

create table public.branches (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  code text not null check (code ~ '^[A-Z0-9_-]{1,16}$'),
  timezone text not null default 'America/Havana',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);

create table public.organization_memberships (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  branch_id bigint,
  role text not null check (role in ('owner', 'seller', 'lens_provider', 'mounting_provider')),
  status text not null default 'active' check (status in ('invited', 'active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, role),
  constraint organization_memberships_branch_fkey
    foreign key (branch_id, organization_id)
    references public.branches(id, organization_id)
    on delete restrict,
  constraint organization_memberships_branch_role_check check (
    (role = 'seller' and branch_id is not null)
    or (role <> 'seller' and branch_id is null)
  )
);

create table public.subscriptions (
  id bigint generated always as identity primary key,
  organization_id bigint not null unique references public.organizations(id) on delete restrict,
  status text not null check (status in ('trial', 'active', 'expired', 'suspended')),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'quarterly', 'semiannual', 'annual', 'custom')),
  starts_on date not null,
  expires_on date not null,
  last_renewed_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on >= starts_on),
  check (last_renewed_on is null or last_renewed_on >= starts_on)
);

create table public.modules (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,49}$'),
  name text not null unique,
  description text not null,
  is_mandatory boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.module_dependencies (
  module_key text not null references public.modules(key) on delete cascade,
  depends_on_module_key text not null references public.modules(key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (module_key, depends_on_module_key),
  check (module_key <> depends_on_module_key)
);

create table public.organization_modules (
  organization_id bigint not null references public.organizations(id) on delete restrict,
  module_key text not null references public.modules(key) on delete restrict,
  is_enabled boolean not null default true,
  changed_at timestamptz not null default now(),
  changed_by uuid not null references auth.users(id) on delete restrict,
  primary key (organization_id, module_key)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id bigint references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.]{2,99}$'),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]{1,79}$'),
  entity_id text,
  origin text not null default 'application' check (origin in ('application', 'database', 'support', 'system')),
  reason text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null default now()
);

create index branches_organization_id_idx on public.branches (organization_id);
create index organization_memberships_user_active_idx
  on public.organization_memberships (user_id, organization_id, role)
  where status = 'active';
create index organization_memberships_organization_branch_idx
  on public.organization_memberships (organization_id, branch_id, role)
  where status = 'active';
create index organization_memberships_branch_id_idx
  on public.organization_memberships (branch_id)
  where branch_id is not null;
create index module_dependencies_depends_on_idx
  on public.module_dependencies (depends_on_module_key);
create index organization_modules_module_key_idx
  on public.organization_modules (module_key);
create index audit_events_organization_occurred_idx
  on public.audit_events (organization_id, occurred_at desc);
create index audit_events_actor_user_id_idx
  on public.audit_events (actor_user_id)
  where actor_user_id is not null;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();
create trigger branches_set_updated_at
before update on public.branches
for each row execute function private.set_updated_at();
create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function private.set_updated_at();
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function private.set_updated_at();

create or replace function private.protect_organization_order_prefix()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.first_order_created_at is not null and new.order_prefix <> old.order_prefix then
    raise exception 'The order prefix cannot change after the first order is created.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger organizations_protect_order_prefix
before update of order_prefix on public.organizations
for each row execute function private.protect_organization_order_prefix();

create or replace function private.validate_module_entitlement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_enabled and exists (
    select 1
    from public.module_dependencies dependency
    where dependency.module_key = new.module_key
      and dependency.depends_on_module_key <> 'core'
      and not exists (
        select 1
        from public.organization_modules enabled_dependency
        where enabled_dependency.organization_id = new.organization_id
          and enabled_dependency.module_key = dependency.depends_on_module_key
          and enabled_dependency.is_enabled
      )
  ) then
    raise exception 'Module dependencies must be enabled first.'
      using errcode = 'check_violation';
  end if;

  if not new.is_enabled and exists (
    select 1
    from public.module_dependencies dependency
    join public.organization_modules dependent
      on dependent.organization_id = new.organization_id
      and dependent.module_key = dependency.module_key
      and dependent.is_enabled
    where dependency.depends_on_module_key = new.module_key
  ) then
    raise exception 'Enabled dependent modules must be disabled first.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger organization_modules_validate_dependencies
before insert or update of is_enabled, module_key on public.organization_modules
for each row execute function private.validate_module_entitlement();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Usuario')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from private.platform_admins pa
      where pa.user_id = (select auth.uid())
    );
$$;

create or replace function private.is_active_organization_member(target_organization_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_memberships om
      join public.profiles p on p.user_id = om.user_id and p.is_active
      where om.organization_id = target_organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    );
$$;

create or replace function private.has_organization_role(target_organization_id bigint, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_memberships om
      join public.profiles p on p.user_id = om.user_id and p.is_active
      where om.organization_id = target_organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.role = any(allowed_roles)
    );
$$;

create or replace function private.can_operate_in_organization(
  target_organization_id bigint,
  required_module_key text default 'core'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      (select private.is_platform_admin())
      or (
        (select private.is_active_organization_member(target_organization_id))
        and exists (
          select 1
          from public.organizations o
          join public.subscriptions s on s.organization_id = o.id
          where o.id = target_organization_id
            and o.status = 'active'
            and s.status in ('trial', 'active')
            and current_date between s.starts_on and s.expires_on
        )
        and (
          required_module_key = 'core'
          or exists (
            select 1
            from public.organization_modules omod
            join public.modules m on m.key = omod.module_key and m.is_active
            where omod.organization_id = target_organization_id
              and omod.module_key = required_module_key
              and omod.is_enabled
          )
        )
      )
    );
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_active_organization_member(bigint) to authenticated;
grant execute on function private.has_organization_role(bigint, text[]) to authenticated;
grant execute on function private.can_operate_in_organization(bigint, text) to authenticated;

insert into public.modules (key, name, description, is_mandatory) values
  ('core', 'Núcleo', 'Organización, usuarios, seguridad, una sucursal, auditoría y suscripción.', true),
  ('optical_sales', 'Ventas ópticas', 'Clientes, recetas, catálogo, cotizaciones, pedidos, pagos y saldos.', false),
  ('cashbox', 'Caja', 'Cajas individuales, cierres, diferencias y consolidación.', false),
  ('production', 'Producción y proveedores', 'Asignaciones, estados, incidencias, repeticiones y acceso externo.', false),
  ('whatsapp', 'WhatsApp', 'Plantillas, envío manual, historial e integración desacoplada.', false),
  ('analytics', 'Analítica', 'Indicadores comerciales y operativos.', false),
  ('multi_branch', 'Multisucursal', 'Sucursales adicionales y vistas consolidadas.', false);

insert into public.module_dependencies (module_key, depends_on_module_key) values
  ('cashbox', 'optical_sales'),
  ('production', 'optical_sales'),
  ('whatsapp', 'optical_sales'),
  ('multi_branch', 'core');

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.modules enable row level security;
alter table public.module_dependencies enable row level security;
alter table public.organization_modules enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_self_or_related
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_platform_admin())
  or exists (
    select 1
    from public.organization_memberships mine
    join public.organization_memberships theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = profiles.user_id
      and theirs.status = 'active'
  )
);

create policy profiles_update_self
on public.profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy organizations_select_members
on public.organizations for select to authenticated
using (
  (select private.is_platform_admin())
  or (select private.is_active_organization_member(id))
);
create policy organizations_insert_platform_admin
on public.organizations for insert to authenticated
with check ((select private.is_platform_admin()));
create policy organizations_update_platform_admin
on public.organizations for update to authenticated
using (
  (select private.is_platform_admin())
  or (select private.has_organization_role(id, array['owner']))
)
with check (
  (select private.is_platform_admin())
  or (select private.has_organization_role(id, array['owner']))
);

create policy branches_select_members
on public.branches for select to authenticated
using (
  (select private.is_platform_admin())
  or (select private.is_active_organization_member(organization_id))
);
create policy branches_insert_owner_or_platform_admin
on public.branches for insert to authenticated
with check (
  (select private.is_platform_admin())
  or (
    (select private.has_organization_role(organization_id, array['owner']))
    and (select private.can_operate_in_organization(organization_id, 'multi_branch'))
  )
);
create policy branches_update_owner_or_platform_admin
on public.branches for update to authenticated
using (
  (select private.is_platform_admin())
  or (select private.has_organization_role(organization_id, array['owner']))
)
with check (
  (select private.is_platform_admin())
  or (select private.has_organization_role(organization_id, array['owner']))
);

create policy memberships_select_self_owner_or_platform_admin
on public.organization_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_platform_admin())
  or (select private.has_organization_role(organization_id, array['owner']))
);
create policy memberships_insert_owner_or_platform_admin
on public.organization_memberships for insert to authenticated
with check (
  (select private.is_platform_admin())
  or (
    role <> 'owner'
    and (select private.has_organization_role(organization_id, array['owner']))
    and (select private.can_operate_in_organization(organization_id, 'core'))
  )
);
create policy memberships_update_owner_or_platform_admin
on public.organization_memberships for update to authenticated
using (
  (select private.is_platform_admin())
  or (role <> 'owner' and (select private.has_organization_role(organization_id, array['owner'])))
)
with check (
  (select private.is_platform_admin())
  or (role <> 'owner' and (select private.has_organization_role(organization_id, array['owner'])))
);

create policy subscriptions_select_owner_or_platform_admin
on public.subscriptions for select to authenticated
using (
  (select private.is_platform_admin())
  or (select private.has_organization_role(organization_id, array['owner']))
);
create policy subscriptions_write_platform_admin
on public.subscriptions for all to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));

create policy modules_select_authenticated
on public.modules for select to authenticated
using (true);
create policy module_dependencies_select_authenticated
on public.module_dependencies for select to authenticated
using (true);

create policy organization_modules_select_owner_or_platform_admin
on public.organization_modules for select to authenticated
using (
  (select private.is_platform_admin())
  or (select private.has_organization_role(organization_id, array['owner']))
);
create policy organization_modules_write_platform_admin
on public.organization_modules for all to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));

create policy audit_events_select_owner_or_platform_admin
on public.audit_events for select to authenticated
using (
  (select private.is_platform_admin())
  or (
    organization_id is not null
    and (select private.has_organization_role(organization_id, array['owner']))
  )
);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;
grant select, insert on public.organizations to authenticated;
grant update (name, order_prefix, timezone) on public.organizations to authenticated;
grant select, insert on public.branches to authenticated;
grant update (name, code, timezone, is_active) on public.branches to authenticated;
grant select, insert on public.organization_memberships to authenticated;
grant update (branch_id, role, status) on public.organization_memberships to authenticated;
grant select, insert, update on public.subscriptions to authenticated;
grant select on public.modules, public.module_dependencies to authenticated;
grant select, insert, update on public.organization_modules to authenticated;
grant select on public.audit_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on public.audit_events from authenticated;
grant select on public.audit_events to authenticated;
