-- Transactional Phase 7 platform administration fixture.
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('27000000-0000-0000-0000-000000000001', 'phase7-admin@example.test', '{"display_name":"Platform Admin"}', now()),
  ('27000000-0000-0000-0000-000000000002', 'phase7-owner@example.test', '{"display_name":"Owner"}', now()),
  ('27000000-0000-0000-0000-000000000003', 'phase7-outsider@example.test', '{"display_name":"Outsider"}', now());
insert into private.platform_admins (user_id, created_by)
values ('27000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001');
insert into public.organizations (id, name, order_prefix) overriding system value
values (970000001, 'Pilot Tenant', 'PILOT');
insert into public.branches (id, organization_id, name, code) overriding system value
values (970000001, 970000001, 'Principal', 'MAIN');
insert into public.organization_memberships (organization_id, user_id, role, status)
values (970000001, '27000000-0000-0000-0000-000000000002', 'owner', 'active');
insert into public.subscriptions (organization_id, status, amount, currency, billing_period, starts_on, expires_on)
values (970000001, 'trial', 0, 'USD', 'monthly', current_date, current_date + 15);
insert into public.organization_modules (organization_id, module_key, changed_by)
values (970000001, 'optical_sales', '27000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '27000000-0000-0000-0000-000000000001', true);

select public.update_platform_organization(
  970000001, 'active', 'active', 49.99, 'USD', 'monthly', current_date,
  current_date + 30, array['optical_sales', 'cashbox'], 'Pilot contract approved'
);

do $$
declare support jsonb; usage jsonb;
begin
  support := public.begin_platform_support_session(970000001, 'Review pilot onboarding configuration', 30);
  if support ->> 'sessionId' is null then raise exception 'Support session was not created'; end if;
  usage := public.get_platform_usage();
  if jsonb_array_length(usage) < 1 then raise exception 'Usage read model returned no tenant'; end if;
  if not public.end_platform_support_session((support ->> 'sessionId')::bigint) then
    raise exception 'Support session did not close';
  end if;
end $$;

do $$ begin
  if (select status from public.organizations where id = 970000001) <> 'active'
    or (select amount from public.subscriptions where organization_id = 970000001) <> 49.99
    or not exists (select 1 from public.organization_modules where organization_id = 970000001 and module_key = 'cashbox' and is_enabled)
    or (select count(*) from public.audit_events where organization_id = 970000001 and event_type in ('organization.contract_changed', 'support.session_started', 'support.session_ended')) <> 3 then
    raise exception 'Platform changes or audit trail are incomplete';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '27000000-0000-0000-0000-000000000003', true);
do $$ begin
  begin
    perform public.update_platform_organization(
      970000001, 'suspended', 'suspended', 0, 'USD', 'monthly', current_date,
      current_date + 1, array['optical_sales'], 'Unauthorized platform change'
    );
    raise exception 'Non-admin platform change unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_platform_usage();
    raise exception 'Non-admin usage query unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
