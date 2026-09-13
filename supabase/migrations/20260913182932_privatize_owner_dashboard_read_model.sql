alter function public.get_owner_dashboard_unchecked(bigint, bigint, uuid, date, date)
  set schema private;

grant execute on function private.get_owner_dashboard_unchecked(bigint, bigint, uuid, date, date)
  to authenticated;

create or replace function public.get_owner_dashboard(
  target_organization_id bigint,
  target_branch_id bigint default null,
  target_seller_id uuid default null,
  date_from date default (current_date - 29),
  date_to date default current_date
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not private.has_organization_role(target_organization_id, array['owner']) then
    raise exception using errcode = '42501', message = 'Solo el propietario puede consultar analítica.';
  end if;
  if not exists (
    select 1 from public.organization_modules entitlement
    where entitlement.organization_id = target_organization_id
      and entitlement.module_key = 'analytics'
      and entitlement.is_enabled
  ) then
    raise exception using errcode = '42501', message = 'El módulo Analítica no está habilitado.';
  end if;
  return private.get_owner_dashboard_unchecked(
    target_organization_id, target_branch_id, target_seller_id, date_from, date_to
  );
end;
$$;
