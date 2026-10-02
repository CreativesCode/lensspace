-- QA-23 (admin part): the platform admin can send a password-reset link to an
-- organization owner. Only platform admins can resolve the owner's login email,
-- and only for users who own an organization.

create or replace function public.platform_owner_email(target_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  owner_email text;
begin
  if not private.is_platform_admin() then
    raise exception 'Solo la administración de la plataforma puede hacer esto.' using errcode = '42501';
  end if;

  select users.email into owner_email
  from auth.users users
  where users.id = target_user_id
    and exists (
      select 1 from public.organization_memberships membership
      where membership.user_id = users.id and membership.role = 'owner'
    );

  return owner_email;
end;
$$;

revoke all on function public.platform_owner_email(uuid) from public, anon;
grant execute on function public.platform_owner_email(uuid) to authenticated;
