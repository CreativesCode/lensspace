-- Transactional archive/delete organization fixture.
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('31000000-0000-0000-0000-000000000001', 'archive-admin@example.test', '{"display_name":"Platform Admin"}', now()),
  ('31000000-0000-0000-0000-000000000002', 'archive-owner@example.test', '{"display_name":"Owner"}', now()),
  ('31000000-0000-0000-0000-000000000003', 'archive-seller@example.test', '{"display_name":"Seller"}', now());
insert into private.platform_admins (user_id, created_by)
values ('31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001');
insert into public.organizations (id, name, order_prefix) overriding system value values
  (996000001, 'Used Optics', 'USE'), (996000002, 'Empty Optics', 'EMP');
insert into public.branches (id, organization_id, name, code) overriding system value values
  (996000001, 996000001, 'Principal', 'MAIN'), (996000002, 996000002, 'Principal', 'MAIN');
insert into public.organization_memberships (organization_id, user_id, role, status, branch_id) values
  (996000001, '31000000-0000-0000-0000-000000000002', 'owner', 'active', null),
  (996000001, '31000000-0000-0000-0000-000000000003', 'seller', 'invited', 996000001),
  (996000002, '31000000-0000-0000-0000-000000000002', 'owner', 'active', null);
insert into public.subscriptions (organization_id, status, amount, currency, billing_period, starts_on, expires_on) values
  (996000001, 'trial', 0, 'USD', 'monthly', current_date, current_date + 14),
  (996000002, 'trial', 0, 'USD', 'monthly', current_date, current_date + 14);
insert into public.organization_modules (organization_id, module_key, changed_by) values
  (996000002, 'optical_sales', '31000000-0000-0000-0000-000000000001');
insert into public.customers (organization_id, branch_id, full_name, created_by)
values (996000001, 996000001, 'Cliente de prueba', '31000000-0000-0000-0000-000000000002');
insert into public.license_contracts (organization_id, plan, module_keys, monthly_amount, starts_on, client_legal_name)
values (996000002, 'basic', array['optical_sales'], 10, current_date, 'Empty Optics');

-- Archive hides the organization from its members; restore brings them back as before.
set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
update public.organizations set status = 'archived' where id = 996000001;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000002', true);
do $$
begin
  if private.is_active_organization_member(996000001) then raise exception 'Owner still a member of an archived organization'; end if;
  if exists (select 1 from public.customers where organization_id = 996000001) then raise exception 'Archived data still readable'; end if;
  if not private.is_active_organization_member(996000002) then raise exception 'Archive leaked to another organization'; end if;
end $$;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
update public.organizations set status = 'active' where id = 996000001;
reset role;
do $$
begin
  if (select status from public.organization_memberships where organization_id = 996000001 and role = 'owner') <> 'active'
    or (select status from public.organization_memberships where organization_id = 996000001 and role = 'seller') <> 'invited' then
    raise exception 'Restore did not bring back the previous membership statuses';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
do $$
declare failed boolean := false;
begin
  begin
    perform public.delete_empty_organization(996000001, 'Used Optics', 'Intento de borrar con actividad');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'An organization with activity was deleted'; end if;

  failed := false;
  begin
    perform public.delete_empty_organization(996000002, 'Otro nombre', 'Creada por error en pruebas');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'Deleted without the exact name'; end if;

  perform public.delete_empty_organization(996000002, 'Empty Optics', 'Creada por error en pruebas');
  if exists (select 1 from public.organizations where id = 996000002) then raise exception 'Empty organization not deleted'; end if;
  if not exists (select 1 from public.audit_events where event_type = 'organization.deleted' and entity_id = '996000002') then
    raise exception 'Deletion not audited';
  end if;
end $$;

rollback;
