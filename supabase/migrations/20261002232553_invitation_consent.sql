-- QA-39: existing accounts were enrolled as ACTIVE the moment an owner invited them.
-- Now every invitation starts as 'invited'. New accounts still activate when they
-- confirm the invitation email; existing accounts accept or decline in the app.

create or replace function public.list_my_pending_invitations()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'membershipId', membership.id,
    'organizationName', organization.name,
    'role', membership.role,
    'branchName', branch.name
  ) order by membership.id), '[]'::jsonb)
  from public.organization_memberships membership
  join public.organizations organization on organization.id = membership.organization_id
  left join public.branches branch on branch.id = membership.branch_id
  where membership.user_id = (select auth.uid())
    and membership.status = 'invited';
$function$;

revoke all on function public.list_my_pending_invitations() from public, anon;
grant execute on function public.list_my_pending_invitations() to authenticated;

create or replace function public.respond_to_organization_invitation(target_membership_id bigint, accept boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  invitation public.organization_memberships%rowtype;
begin
  select * into invitation from public.organization_memberships
  where id = target_membership_id and user_id = (select auth.uid()) and status = 'invited'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'La invitación ya no está disponible.';
  end if;

  update public.organization_memberships
  set status = case when accept then 'active' else 'inactive' end
  where id = invitation.id;

  insert into public.audit_events (organization_id, actor_user_id, event_type, entity_type, entity_id, origin, payload)
  values (
    invitation.organization_id, (select auth.uid()),
    case when accept then 'membership.invitation_accepted' else 'membership.invitation_declined' end,
    'organization_membership', invitation.id::text, 'application',
    jsonb_build_object('role', invitation.role, 'branch_id', invitation.branch_id)
  );
end;
$function$;

revoke all on function public.respond_to_organization_invitation(bigint, boolean) from public, anon;
grant execute on function public.respond_to_organization_invitation(bigint, boolean) to authenticated;

-- An owner can edit an invited member (branch) or deactivate the invitation, but
-- never activate it on the invitee's behalf.
do $migration$
declare
  definition text := pg_get_functiondef('public.manage_organization_member(bigint, text, bigint)'::regprocedure);
  patched text;
begin
  patched := replace(
    definition,
    'status = target_status,',
    'status = case when current_membership.status = ''invited'' and target_status = ''active'' then ''invited'' else target_status end,'
  );
  if patched = definition then
    raise exception 'manage_organization_member did not contain the expected status assignment';
  end if;
  execute patched;
end;
$migration$;
