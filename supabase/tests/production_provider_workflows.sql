-- Transactional provider workflow fixture. Run after all migrations.
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('20000000-0000-0000-0000-000000000001', 'production-seller@example.test', '{"display_name":"Seller"}', now()),
  ('20000000-0000-0000-0000-000000000002', 'production-other@example.test', '{"display_name":"Other Seller"}', now()),
  ('20000000-0000-0000-0000-000000000003', 'production-owner@example.test', '{"display_name":"Owner"}', now()),
  ('20000000-0000-0000-0000-000000000004', 'lens-provider@example.test', '{"display_name":"Lens Provider"}', now()),
  ('20000000-0000-0000-0000-000000000005', 'mount-provider@example.test', '{"display_name":"Mount Provider"}', now());
insert into public.organizations (id, name, order_prefix, timezone) overriding system value
values (920000001, 'Production Test', 'PRDQA', 'America/Havana');
insert into public.branches (id, organization_id, name, code) overriding system value
values (920000001, 920000001, 'Main', 'MAIN');
insert into public.organization_memberships (organization_id, user_id, branch_id, role, status) values
  (920000001, '20000000-0000-0000-0000-000000000001', 920000001, 'seller', 'active'),
  (920000001, '20000000-0000-0000-0000-000000000002', 920000001, 'seller', 'active'),
  (920000001, '20000000-0000-0000-0000-000000000003', null, 'owner', 'active'),
  (920000001, '20000000-0000-0000-0000-000000000004', null, 'lens_provider', 'active'),
  (920000001, '20000000-0000-0000-0000-000000000005', null, 'mounting_provider', 'active');
insert into public.subscriptions (organization_id, status, starts_on, expires_on)
values (920000001, 'active', current_date - 1, current_date + 1);
insert into public.organization_modules (organization_id, module_key, changed_by) values
  (920000001, 'optical_sales', '20000000-0000-0000-0000-000000000003'),
  (920000001, 'production', '20000000-0000-0000-0000-000000000003');
insert into public.customers (id, organization_id, branch_id, full_name, created_by) overriding system value
values (920000001, 920000001, 920000001, 'Production Customer', '20000000-0000-0000-0000-000000000001');
insert into public.quotations (id, organization_id, branch_id, customer_id, seller_id, status, usd_to_cup_rate, totals, cup_equivalent) overriding system value
values (920000001, 920000001, 920000001, 920000001, '20000000-0000-0000-0000-000000000001', 'accepted', 400, '{}', 1000);
insert into public.orders (id, order_number, organization_id, branch_id, customer_id, quotation_id, primary_seller_id, usd_to_cup_rate, totals, cup_equivalent) overriding system value
values (920000001, 'PRDQA-2092-000001', 920000001, 920000001, 920000001, 920000001, '20000000-0000-0000-0000-000000000001', 400, '{}', 1000);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.assign_production_job(920000001, 'lens', '20000000-0000-0000-0000-000000000004');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
do $$ begin
  if jsonb_array_length(public.list_accessible_production_jobs()) <> 1 then
    raise exception 'Assigned provider cannot see the job';
  end if;
end $$;
select public.transition_production_job((select id from public.production_jobs), 'in_production', 'Provider started manufacturing');
select public.transition_production_job((select id from public.production_jobs), 'completed', 'Provider marked the work ready');
select public.report_production_incident((select id from public.production_jobs), 'Right lens has a visible bubble.', 'lens_provider');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
do $$ begin
  if jsonb_array_length(public.list_accessible_production_jobs()) <> 0 then
    raise exception 'Unrelated seller can see production jobs';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.create_production_rework((select id from public.production_incidents));
do $$ begin
  if (select count(*) from public.production_jobs where is_current) <> 1
    or (select count(*) from public.production_jobs where not is_current and status = 'incident') <> 1 then
    raise exception 'Rework did not supersede the incident job correctly';
  end if;
  if (select count(*) from public.production_job_events) <> 5 then
    raise exception 'Unexpected production event history';
  end if;
  if (select cost_responsibility from public.production_incidents) <> 'lens_provider' then
    raise exception 'Cost responsibility was not preserved';
  end if;
end $$;

do $$ begin
  begin
    update public.production_jobs set work_snapshot = '{}' where dispatched_at is not null;
    raise exception 'Authenticated snapshot edit unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.production_job_events;
    raise exception 'Event deletion unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
