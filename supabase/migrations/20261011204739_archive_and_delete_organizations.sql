-- Archive and delete organizations (product owner, 2026-10-11).
-- Archived: nobody of the organization can sign in to it; data is kept and the
-- organization can be restored. Every access path already requires an active
-- membership, so archiving deactivates the memberships and remembers their previous
-- status; restoring puts them back. Delete: only an organization without any activity
-- (created by mistake or left during the trial without using it).

create table private.archived_memberships (
  membership_id bigint primary key references public.organization_memberships(id) on delete cascade,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  previous_status text not null check (previous_status in ('invited', 'active'))
);

create index archived_memberships_organization_idx on private.archived_memberships (organization_id);

create or replace function private.sync_archived_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'archived' and old.status <> 'archived' then
    insert into private.archived_memberships (membership_id, organization_id, previous_status)
    select id, organization_id, status from public.organization_memberships
    where organization_id = new.id and status in ('invited', 'active')
    on conflict (membership_id) do nothing;
    update public.organization_memberships set status = 'inactive', updated_at = now()
    where organization_id = new.id and status in ('invited', 'active');
  elsif old.status = 'archived' and new.status <> 'archived' then
    update public.organization_memberships membership set status = archived.previous_status, updated_at = now()
    from private.archived_memberships archived
    where archived.membership_id = membership.id and archived.organization_id = new.id;
    delete from private.archived_memberships where organization_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_archived_memberships() from public, anon, authenticated;

create trigger organizations_sync_archived_memberships
after update of status on public.organizations
for each row execute function private.sync_archived_memberships();

-- Deletes an organization that never operated. Anything with history (customers,
-- sales, payments, production, messages, a signed contract or referrals) is archived
-- instead. The owner's account stays: it may belong to other organizations.
create or replace function public.delete_empty_organization(target_organization_id bigint, confirm_name text, change_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare organization public.organizations%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede eliminar organizaciones.';
  end if;
  if char_length(btrim(coalesce(change_reason, ''))) < 10 then
    raise exception using errcode = '22023', message = 'Explica el motivo (mínimo 10 caracteres).';
  end if;
  select * into organization from public.organizations where id = target_organization_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Organización no encontrada.'; end if;
  if btrim(coalesce(confirm_name, '')) <> organization.name then
    raise exception using errcode = '22023', message = 'Escribe el nombre exacto de la organización para confirmar.';
  end if;
  if exists (select 1 from public.customers where organization_id = organization.id)
    or exists (select 1 from public.quotations where organization_id = organization.id)
    or exists (select 1 from public.orders where organization_id = organization.id)
    or exists (select 1 from public.payments where organization_id = organization.id)
    or exists (select 1 from public.seller_cashboxes where organization_id = organization.id)
    or exists (select 1 from public.production_jobs where organization_id = organization.id)
    or exists (select 1 from public.notification_attempts where organization_id = organization.id) then
    raise exception using errcode = '55000', message = 'La organización tiene actividad registrada: archívala en lugar de eliminarla.';
  end if;
  if exists (select 1 from public.license_contracts where organization_id = organization.id and status in ('signed', 'superseded'))
    or exists (select 1 from public.license_contracts where referred_by_organization_id = organization.id) then
    raise exception using errcode = '55000', message = 'La organización tiene contratos firmados o referidos: archívala en lugar de eliminarla.';
  end if;

  delete from public.audit_events where organization_id = organization.id;
  delete from public.platform_support_sessions where organization_id = organization.id;
  delete from public.license_contracts where organization_id = organization.id;
  delete from public.organization_modules where organization_id = organization.id;
  delete from public.subscriptions where organization_id = organization.id;
  delete from public.organization_memberships where organization_id = organization.id;
  delete from public.order_counters where organization_id = organization.id;
  delete from public.catalog_item_compatibilities where organization_id = organization.id;
  delete from public.catalog_item_overrides where organization_id = organization.id;
  delete from public.graduation_rules where organization_id = organization.id;
  delete from public.catalog_items where organization_id = organization.id;
  delete from public.branches where organization_id = organization.id;
  delete from public.organizations where id = organization.id;

  -- Kept at platform level (organization_id null) because the organization is gone.
  perform private.write_platform_audit(
    null, 'organization.deleted', 'organization', organization.id::text, change_reason,
    jsonb_build_object('name', organization.name, 'orderPrefix', organization.order_prefix)
  );
  return true;
end;
$$;

revoke all on function public.delete_empty_organization(bigint, text, text) from public, anon;
grant execute on function public.delete_empty_organization(bigint, text, text) to authenticated;
