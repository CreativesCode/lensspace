-- Multi-branch management (prp-multi-branch-management.md).
-- Product owner decisions 2026-10-10: only the platform admin creates branches; a
-- seller works in one branch; customers stay per branch; one order sequence per
-- organization. Active branches are limited by the signed license contract.

-- The primary branch keeps operating when the multi_branch module is disabled.
alter table public.branches add column is_primary boolean not null default false;

update public.branches branch set is_primary = true
where branch.id = (select min(other.id) from public.branches other where other.organization_id = branch.organization_id);

create unique index branches_one_primary_idx on public.branches (organization_id) where is_primary;

-- Writes are allowed only in an active branch; a non-primary branch also needs the
-- multi_branch module (BUSINESS_LOGIC: without it the other branches are read-only).
create or replace function private.is_operational_branch(target_organization_id bigint, target_branch_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.branches branch
    where branch.id = target_branch_id
      and branch.organization_id = target_organization_id
      and branch.is_active
      and (
        branch.is_primary
        or exists (
          select 1 from public.organization_modules entitlement
          where entitlement.organization_id = target_organization_id
            and entitlement.module_key = 'multi_branch'
            and entitlement.is_enabled
        )
      )
  );
$$;

revoke all on function private.is_operational_branch(bigint, bigint) from public, anon;
grant execute on function private.is_operational_branch(bigint, bigint) to authenticated;

create or replace function private.can_write_branch_clinical_data(target_organization_id bigint, target_branch_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      private.has_organization_role(target_organization_id, array['owner'])
      or exists (
        select 1
        from public.organization_memberships membership
        join public.profiles profile
          on profile.user_id = membership.user_id
          and profile.is_active
        where membership.organization_id = target_organization_id
          and membership.branch_id = target_branch_id
          and membership.user_id = (select auth.uid())
          and membership.role = 'seller'
          and membership.status = 'active'
      )
    )
    and private.can_operate_in_organization(target_organization_id, 'optical_sales')
    and private.is_operational_branch(target_organization_id, target_branch_id);
$$;

create or replace function private.can_write_seller_sale(target_organization_id bigint, target_branch_id bigint, target_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_seller_sale(target_organization_id, target_branch_id, target_seller_id)
    and private.can_operate_in_organization(target_organization_id, 'optical_sales')
    and private.is_operational_branch(target_organization_id, target_branch_id);
$$;

-- 1 included branch + the extra branches of the signed license contract.
create or replace function private.branch_limit(target_organization_id bigint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 1 + coalesce((
    select contract.extra_branches from public.license_contracts contract
    where contract.organization_id = target_organization_id and contract.status = 'signed'
  ), 0);
$$;

revoke all on function private.branch_limit(bigint) from public, anon, authenticated;

-- Branches are created and changed only through the admin RPCs below.
drop policy branches_insert_owner_or_platform_admin on public.branches;
drop policy branches_update_owner_or_platform_admin on public.branches;
revoke insert, update, delete on public.branches from authenticated;

create or replace function private.assert_branch_input(branch_name text, branch_code text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(branch_name, ''))) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Escribe el nombre de la sucursal (máximo 120 caracteres).';
  end if;
  if upper(btrim(coalesce(branch_code, ''))) !~ '^[A-Z0-9_-]{1,16}$' then
    raise exception using errcode = '22023', message = 'El código usa solo letras, números, guion o guion bajo (máximo 16).';
  end if;
end;
$$;

revoke all on function private.assert_branch_input(text, text) from public, anon, authenticated;

create or replace function public.create_branch(target_organization_id bigint, branch_name text, branch_code text, change_reason text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  branch_limit integer;
  new_branch_id bigint;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede crear sucursales.';
  end if;
  perform private.assert_branch_input(branch_name, branch_code);
  perform 1 from public.organizations where id = target_organization_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Organización no encontrada.'; end if;
  if not exists (
    select 1 from public.organization_modules
    where organization_id = target_organization_id and module_key = 'multi_branch' and is_enabled
  ) then
    raise exception using errcode = '55000', message = 'Activa primero el módulo Multisucursal.';
  end if;
  branch_limit := private.branch_limit(target_organization_id);
  if (select count(*) from public.branches where organization_id = target_organization_id and is_active) >= branch_limit then
    raise exception using errcode = '55000',
      message = format('El contrato firmado incluye %s sucursal(es) activa(s). Amplía las sucursales extra en un contrato nuevo.', branch_limit);
  end if;
  if exists (select 1 from public.branches where organization_id = target_organization_id and code = upper(btrim(branch_code))) then
    raise exception using errcode = '23505', message = 'Ya existe una sucursal con ese código.';
  end if;

  insert into public.branches (organization_id, name, code, timezone)
  select target_organization_id, btrim(branch_name), upper(btrim(branch_code)), organization.timezone
  from public.organizations organization where organization.id = target_organization_id
  returning id into new_branch_id;

  perform private.write_platform_audit(
    target_organization_id, 'branch.created', 'branch', new_branch_id::text, change_reason,
    jsonb_build_object('name', btrim(branch_name), 'code', upper(btrim(branch_code)))
  );
  return new_branch_id;
end;
$$;

create or replace function public.update_branch(target_branch_id bigint, branch_name text, branch_code text, change_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare branch public.branches%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede editar sucursales.';
  end if;
  perform private.assert_branch_input(branch_name, branch_code);
  if exists (
    select 1 from public.branches other join public.branches target on target.id = target_branch_id
    where other.organization_id = target.organization_id and other.id <> target.id and other.code = upper(btrim(branch_code))
  ) then
    raise exception using errcode = '23505', message = 'Ya existe una sucursal con ese código.';
  end if;
  update public.branches set name = btrim(branch_name), code = upper(btrim(branch_code)), updated_at = now()
  where id = target_branch_id returning * into branch;
  if not found then raise exception using errcode = 'P0002', message = 'Sucursal no encontrada.'; end if;
  perform private.write_platform_audit(
    branch.organization_id, 'branch.updated', 'branch', branch.id::text, change_reason,
    jsonb_build_object('name', branch.name, 'code', branch.code)
  );
  return true;
end;
$$;

-- Deactivating keeps every record readable; it is blocked while the branch still has
-- work in progress so nothing gets stuck in a read-only branch.
create or replace function public.set_branch_active(target_branch_id bigint, target_active boolean, change_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare branch public.branches%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede activar o desactivar sucursales.';
  end if;
  if char_length(btrim(coalesce(change_reason, ''))) < 10 then
    raise exception using errcode = '22023', message = 'Explica el motivo (mínimo 10 caracteres).';
  end if;
  select * into branch from public.branches where id = target_branch_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Sucursal no encontrada.'; end if;
  if branch.is_active = target_active then return false; end if;

  if target_active then
    if (select count(*) from public.branches where organization_id = branch.organization_id and is_active)
      >= private.branch_limit(branch.organization_id) then
      raise exception using errcode = '55000', message = 'El contrato firmado no incluye más sucursales activas.';
    end if;
  else
    if branch.is_primary then
      raise exception using errcode = '55000', message = 'La sucursal principal no se desactiva: elige otra como principal primero.';
    end if;
    if exists (select 1 from public.orders where branch_id = branch.id and commercial_status = 'accepted') then
      raise exception using errcode = '55000', message = 'La sucursal tiene pedidos sin entregar.';
    end if;
    if exists (
      select 1 from public.payments payment
      where payment.branch_id = branch.id
        and not exists (select 1 from public.cashbox_closure_payments closed where closed.payment_id = payment.id)
    ) then
      raise exception using errcode = '55000', message = 'La sucursal tiene cobros sin cerrar en caja.';
    end if;
    if exists (
      select 1 from public.organization_memberships
      where branch_id = branch.id and status in ('active', 'invited')
    ) then
      raise exception using errcode = '55000', message = 'Reasigna primero los vendedores de esta sucursal.';
    end if;
  end if;

  update public.branches set is_active = target_active, updated_at = now() where id = branch.id;
  perform private.write_platform_audit(
    branch.organization_id, case when target_active then 'branch.activated' else 'branch.deactivated' end,
    'branch', branch.id::text, change_reason, jsonb_build_object('name', branch.name)
  );
  return true;
end;
$$;

create or replace function public.set_primary_branch(target_branch_id bigint, change_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare branch public.branches%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede cambiar la sucursal principal.';
  end if;
  select * into branch from public.branches where id = target_branch_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Sucursal no encontrada.'; end if;
  if not branch.is_active then
    raise exception using errcode = '55000', message = 'Solo una sucursal activa puede ser la principal.';
  end if;
  if branch.is_primary then return false; end if;
  update public.branches set is_primary = false, updated_at = now() where organization_id = branch.organization_id and is_primary;
  update public.branches set is_primary = true, updated_at = now() where id = branch.id;
  perform private.write_platform_audit(
    branch.organization_id, 'branch.primary_changed', 'branch', branch.id::text, change_reason,
    jsonb_build_object('name', branch.name)
  );
  return true;
end;
$$;

revoke all on function public.create_branch(bigint, text, text, text), public.update_branch(bigint, text, text, text),
  public.set_branch_active(bigint, boolean, text), public.set_primary_branch(bigint, text) from public, anon;
grant execute on function public.create_branch(bigint, text, text, text), public.update_branch(bigint, text, text, text),
  public.set_branch_active(bigint, boolean, text), public.set_primary_branch(bigint, text) to authenticated;
