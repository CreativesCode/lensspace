-- Follow-up hardening from Supabase performance advisors.

create index platform_admins_created_by_idx
  on private.platform_admins (created_by)
  where created_by is not null;

create index organization_memberships_branch_organization_idx
  on public.organization_memberships (branch_id, organization_id)
  where branch_id is not null;

create index organization_modules_changed_by_idx
  on public.organization_modules (changed_by);

drop policy subscriptions_write_platform_admin on public.subscriptions;
create policy subscriptions_insert_platform_admin
on public.subscriptions for insert to authenticated
with check ((select private.is_platform_admin()));
create policy subscriptions_update_platform_admin
on public.subscriptions for update to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));

drop policy organization_modules_write_platform_admin on public.organization_modules;
create policy organization_modules_insert_platform_admin
on public.organization_modules for insert to authenticated
with check ((select private.is_platform_admin()));
create policy organization_modules_update_platform_admin
on public.organization_modules for update to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));
