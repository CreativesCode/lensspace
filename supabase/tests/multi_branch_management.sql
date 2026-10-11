-- Transactional multi-branch fixture (prp-multi-branch-management.md).
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('29000000-0000-0000-0000-000000000001', 'branch-admin@example.test', '{"display_name":"Platform Admin"}', now()),
  ('29000000-0000-0000-0000-000000000002', 'branch-owner@example.test', '{"display_name":"Owner"}', now()),
  ('29000000-0000-0000-0000-000000000003', 'branch-seller@example.test', '{"display_name":"Seller"}', now());
insert into private.platform_admins (user_id, created_by)
values ('29000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001');
insert into public.organizations (id, name, order_prefix) overriding system value values (990000001, 'Branch Optics', 'BRA');
insert into public.branches (id, organization_id, name, code, is_primary) overriding system value
values (990000001, 990000001, 'Principal', 'MAIN', true);
insert into public.organization_memberships (organization_id, user_id, role, status, branch_id) values
  (990000001, '29000000-0000-0000-0000-000000000002', 'owner', 'active', null),
  (990000001, '29000000-0000-0000-0000-000000000003', 'seller', 'active', 990000001);
insert into public.subscriptions (organization_id, status, amount, currency, billing_period, starts_on, expires_on)
values (990000001, 'active', 15, 'USD', 'monthly', current_date, current_date + 30);
insert into public.organization_modules (organization_id, module_key, changed_by)
values (990000001, 'optical_sales', '29000000-0000-0000-0000-000000000001');
insert into public.license_contracts (organization_id, status, plan, module_keys, extra_branches, monthly_amount, starts_on, ends_on,
  client_legal_name, signed_file_path, signed_at)
values (990000001, 'signed', 'custom', array['optical_sales', 'multi_branch'], 1, 15, current_date, current_date + 365,
  'Branch Optics', '990000001/1/firmado.pdf', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000001', true);

do $$
declare failed boolean := false; second_branch bigint;
begin
  begin
    perform public.create_branch(990000001, 'Centro', 'CEN', 'Apertura de la sucursal Centro');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'Branch created without the multi_branch module'; end if;

  perform set_config('role', 'postgres', true);
  insert into public.organization_modules (organization_id, module_key, changed_by)
  values (990000001, 'multi_branch', '29000000-0000-0000-0000-000000000001');
  perform set_config('role', 'authenticated', true);

  second_branch := public.create_branch(990000001, 'Centro', 'cen', 'Apertura de la sucursal Centro');
  if (select code from public.branches where id = second_branch) <> 'CEN' then raise exception 'Code was not normalized'; end if;

  failed := false;
  begin
    perform public.create_branch(990000001, 'Playa', 'PLA', 'Tercera sucursal sin contrato');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'Branch limit from the signed contract was not enforced'; end if;

  -- The owner works in the extra branch only while multi_branch is enabled.
  perform set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000002', true);
  if not private.can_write_branch_clinical_data(990000001, second_branch) then raise exception 'Owner cannot write in the extra branch'; end if;
  failed := false;
  begin
    perform public.create_branch(990000001, 'Playa', 'PLA', 'El dueño intenta crear sucursal');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'Owner created a branch'; end if;

  perform set_config('role', 'postgres', true);
  update public.organization_modules set is_enabled = false where organization_id = 990000001 and module_key = 'multi_branch';
  perform set_config('role', 'authenticated', true);
  if private.can_write_branch_clinical_data(990000001, second_branch) then raise exception 'Extra branch writable without multi_branch'; end if;
  if not private.can_write_branch_clinical_data(990000001, 990000001) then raise exception 'Primary branch became read-only'; end if;
  perform set_config('role', 'postgres', true);
  update public.organization_modules set is_enabled = true where organization_id = 990000001 and module_key = 'multi_branch';
  perform set_config('role', 'authenticated', true);

  perform set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000001', true);
  failed := false;
  begin
    perform public.set_branch_active(990000001, false, 'Cerrar la sucursal principal');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'Primary branch was deactivated'; end if;

  perform public.set_primary_branch(second_branch, 'Centro pasa a ser la principal');
  if not (select is_primary from public.branches where id = second_branch) then raise exception 'Primary did not move'; end if;

  failed := false;
  begin
    perform public.set_branch_active(990000001, false, 'Cerrar la sucursal antigua');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'Branch with an assigned seller was deactivated'; end if;

  perform set_config('role', 'postgres', true);
  update public.organization_memberships set branch_id = second_branch where user_id = '29000000-0000-0000-0000-000000000003';
  perform set_config('role', 'authenticated', true);
  if not public.set_branch_active(990000001, false, 'Cerrar la sucursal antigua') then raise exception 'Deactivation failed'; end if;
  if private.is_operational_branch(990000001, 990000001) then raise exception 'Inactive branch still operational'; end if;
end $$;

-- Onboarding inserts the first branch without is_primary: the trigger marks it.
reset role;
insert into public.organizations (id, name, order_prefix) overriding system value values (990000002, 'Fresh Optics', 'FRE');
insert into public.branches (organization_id, name, code) values (990000002, 'Principal', 'MAIN');
do $$
begin
  if not (select is_primary from public.branches where organization_id = 990000002) then
    raise exception 'First branch was not marked primary';
  end if;
end $$;

rollback;
