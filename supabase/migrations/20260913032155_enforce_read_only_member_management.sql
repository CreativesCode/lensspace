-- Expired and suspended organizations remain readable but cannot mutate team
-- membership through the owner workflow.

create or replace function public.current_user_can_manage_organization(
  target_organization_id bigint
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    private.is_platform_admin()
    or (
      private.has_organization_role(target_organization_id, array['owner'])
      and private.can_operate_in_organization(target_organization_id, 'core')
    );
$$;
