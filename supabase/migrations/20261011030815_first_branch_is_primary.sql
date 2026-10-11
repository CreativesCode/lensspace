-- The first branch of an organization (created by onboarding) is its primary branch;
-- without it a new organization could not operate unless multi_branch were enabled.
create or replace function private.mark_first_branch_primary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.branches where organization_id = new.organization_id) then
    new.is_primary := true;
  end if;
  return new;
end;
$$;

revoke all on function private.mark_first_branch_primary() from public, anon, authenticated;

create trigger branches_mark_first_primary
before insert on public.branches
for each row execute function private.mark_first_branch_primary();
