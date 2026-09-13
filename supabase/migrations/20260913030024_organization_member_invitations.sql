-- Owner-managed seller and provider invitations.

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
    or private.has_organization_role(target_organization_id, array['owner']);
$$;

revoke all on function public.current_user_can_manage_organization(bigint)
from public, anon;
grant execute on function public.current_user_can_manage_organization(bigint)
to authenticated;

create or replace function public.find_auth_user_by_email(target_email text)
returns table (user_id uuid, is_confirmed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email_confirmed_at is not null
  from auth.users u
  where lower(u.email) = lower(btrim(target_email))
    and u.deleted_at is null
  limit 1;
$$;

revoke all on function public.find_auth_user_by_email(text)
from public, anon, authenticated;
grant execute on function public.find_auth_user_by_email(text)
to service_role;

create or replace function public.add_organization_member(
  actor_user_id uuid,
  target_user_id uuid,
  target_organization_id bigint,
  target_branch_id bigint,
  target_role text,
  target_status text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_id bigint;
begin
  if not (
    exists (
      select 1 from private.platform_admins pa where pa.user_id = actor_user_id
    )
    or exists (
      select 1
      from public.organization_memberships membership
      join public.profiles profile
        on profile.user_id = membership.user_id
        and profile.is_active
      where membership.organization_id = target_organization_id
        and membership.user_id = actor_user_id
        and membership.role = 'owner'
        and membership.status = 'active'
    )
  ) then
    raise exception 'Only the organization owner can manage its team.'
      using errcode = 'insufficient_privilege';
  end if;

  if target_role not in ('seller', 'lens_provider', 'mounting_provider') then
    raise exception 'Invalid managed member role.'
      using errcode = 'check_violation';
  end if;

  if target_status not in ('invited', 'active') then
    raise exception 'Invalid initial membership status.'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.user_id = target_user_id
      and profile.is_active
  ) then
    raise exception 'The invited user profile does not exist or is inactive.'
      using errcode = 'foreign_key_violation';
  end if;

  if target_role = 'seller' then
    if target_branch_id is null or not exists (
      select 1
      from public.branches branch
      where branch.id = target_branch_id
        and branch.organization_id = target_organization_id
        and branch.is_active
    ) then
      raise exception 'A seller requires an active branch in the organization.'
        using errcode = 'check_violation';
    end if;
  elsif target_branch_id is not null then
    raise exception 'External providers are assigned to the organization, not a branch.'
      using errcode = 'check_violation';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    branch_id,
    role,
    status
  )
  values (
    target_organization_id,
    target_user_id,
    target_branch_id,
    target_role,
    target_status
  )
  on conflict (organization_id, user_id, role)
  do update set
    branch_id = excluded.branch_id,
    status = excluded.status
  returning id into membership_id;

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
    target_organization_id,
    actor_user_id,
    'membership.invited',
    'organization_membership',
    membership_id::text,
    'application',
    jsonb_build_object(
      'user_id', target_user_id,
      'role', target_role,
      'branch_id', target_branch_id,
      'status', target_status
    )
  );

  return membership_id;
end;
$$;

revoke all on function public.add_organization_member(
  uuid,
  uuid,
  bigint,
  bigint,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.add_organization_member(
  uuid,
  uuid,
  bigint,
  bigint,
  text,
  text
) to service_role;

create or replace function private.activate_confirmed_user_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.organization_memberships
    set status = 'active'
    where user_id = new.id
      and status = 'invited';
  end if;

  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row execute function private.activate_confirmed_user_memberships();

revoke all on function private.activate_confirmed_user_memberships()
from public, anon, authenticated;
