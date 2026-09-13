-- Allow active members to discover their enabled modules without exposing
-- negotiated subscription amounts.

drop policy organization_modules_select_owner_or_platform_admin
on public.organization_modules;

create policy organization_modules_select_members
on public.organization_modules for select to authenticated
using (
  (select private.is_platform_admin())
  or (select private.is_active_organization_member(organization_id))
);

create or replace function public.current_user_can_operate_organization(
  target_organization_id bigint,
  required_module_key text default 'core'
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.can_operate_in_organization(
    target_organization_id,
    required_module_key
  );
$$;

revoke all on function public.current_user_can_operate_organization(bigint, text)
from public, anon;
grant execute on function public.current_user_can_operate_organization(bigint, text)
to authenticated;
