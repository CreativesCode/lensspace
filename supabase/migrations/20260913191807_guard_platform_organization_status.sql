create or replace function private.guard_platform_organization_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status and not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Solo el administrador de plataforma puede cambiar el estado de la organización.';
  end if;
  return new;
end;
$$;

create trigger organizations_guard_platform_status
before update of status on public.organizations
for each row execute function private.guard_platform_organization_status();

grant update (status) on public.organizations to authenticated;
