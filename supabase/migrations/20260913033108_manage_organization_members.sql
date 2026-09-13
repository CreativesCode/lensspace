-- Owner-managed member deactivation, reactivation and seller branch reassignment.

create or replace function public.manage_organization_member(
  target_membership_id bigint,
  target_status text,
  target_branch_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  current_membership public.organization_memberships%rowtype;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = 'insufficient_privilege';
  end if;

  select membership.*
  into current_membership
  from public.organization_memberships membership
  where membership.id = target_membership_id
  for update;

  if not found then
    raise exception 'The organization membership does not exist.'
      using errcode = 'no_data_found';
  end if;

  if not (
    exists (
      select 1
      from private.platform_admins administrator
      where administrator.user_id = actor_user_id
    )
    or (
      exists (
        select 1
        from public.organization_memberships owner_membership
        join public.profiles owner_profile
          on owner_profile.user_id = owner_membership.user_id
          and owner_profile.is_active
        where owner_membership.organization_id = current_membership.organization_id
          and owner_membership.user_id = actor_user_id
          and owner_membership.role = 'owner'
          and owner_membership.status = 'active'
      )
      and private.can_operate_in_organization(
        current_membership.organization_id,
        'core'
      )
    )
  ) then
    raise exception 'Only an active organization owner can manage its team.'
      using errcode = 'insufficient_privilege';
  end if;

  if current_membership.role not in (
    'seller',
    'lens_provider',
    'mounting_provider'
  ) then
    raise exception 'Organization owners cannot be changed through this workflow.'
      using errcode = 'check_violation';
  end if;

  if target_status not in ('active', 'inactive') then
    raise exception 'A managed membership must be active or inactive.'
      using errcode = 'check_violation';
  end if;

  if current_membership.role = 'seller' then
    if target_branch_id is null or not exists (
      select 1
      from public.branches branch
      where branch.id = target_branch_id
        and branch.organization_id = current_membership.organization_id
        and branch.is_active
    ) then
      raise exception 'A seller requires an active branch in the organization.'
        using errcode = 'check_violation';
    end if;
  elsif target_branch_id is not null then
    raise exception 'External providers are assigned to the organization, not a branch.'
      using errcode = 'check_violation';
  end if;

  update public.organization_memberships
  set
    status = target_status,
    branch_id = target_branch_id
  where id = target_membership_id;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    origin,
    payload
  )
  values (
    current_membership.organization_id,
    actor_user_id,
    'membership.updated',
    'organization_membership',
    target_membership_id::text,
    'application',
    jsonb_build_object(
      'user_id', current_membership.user_id,
      'role', current_membership.role,
      'previous_status', current_membership.status,
      'status', target_status,
      'previous_branch_id', current_membership.branch_id,
      'branch_id', target_branch_id
    )
  );
end;
$$;

revoke all on function public.manage_organization_member(bigint, text, bigint)
from public, anon;
grant execute on function public.manage_organization_member(bigint, text, bigint)
to authenticated;

-- All member changes from authenticated clients must pass through the audited
-- function above. The invitation Edge Function keeps its service-role access.
revoke update on public.organization_memberships from authenticated;
