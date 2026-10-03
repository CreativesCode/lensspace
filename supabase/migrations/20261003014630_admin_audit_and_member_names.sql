-- Phase 5 low items: QA-53 (base catalog audit), QA-55 (last_renewed_on), QA-56
-- (auto-closed support session audit), QA-58 (owners read inactive/invited member
-- names) and the Spanish message of the order-prefix lock (QA-50).

-- QA-53: base catalog rows (organization_id is null) are written directly by the
-- platform admin; record price/availability changes in the audit trail.
create or replace function private.audit_base_catalog_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.cost_amount is not distinct from old.cost_amount
    and new.sale_price is not distinct from old.sale_price
    and new.currency is not distinct from old.currency
    and new.is_active is not distinct from old.is_active
    and new.name is not distinct from old.name then
    return new;
  end if;
  insert into public.audit_events (organization_id, actor_user_id, event_type, entity_type, entity_id, origin, payload)
  values (
    null, (select auth.uid()),
    case tg_op when 'INSERT' then 'catalog.base_item_created' else 'catalog.base_item_changed' end,
    'catalog_item', new.id::text, 'database',
    jsonb_build_object(
      'name', new.name,
      'old', case when tg_op = 'UPDATE' then jsonb_build_object('costAmount', old.cost_amount, 'salePrice', old.sale_price, 'currency', old.currency, 'isActive', old.is_active) end,
      'new', jsonb_build_object('costAmount', new.cost_amount, 'salePrice', new.sale_price, 'currency', new.currency, 'isActive', new.is_active)
    )
  );
  return new;
end;
$$;

revoke all on function private.audit_base_catalog_item() from public, anon, authenticated;

create or replace trigger catalog_items_audit_base
after insert or update on public.catalog_items
for each row execute function private.audit_base_catalog_item();

-- QA-55 and QA-56: patch the existing definitions in place.
do $$
declare
  definition text;
  patched text;
begin
  definition := pg_get_functiondef('public.update_platform_organization(bigint,text,text,numeric,text,text,date,date,text[],text)'::regprocedure);
  patched := replace(definition,
    $old$last_renewed_on = case when target_subscription_status = 'active' then current_date else last_renewed_on end,$old$,
    $new$last_renewed_on = case
      when target_subscription_status = 'active'
        and (status <> 'active' or target_expires_on > expires_on) then current_date
      else last_renewed_on
    end,$new$);
  if patched = definition then
    raise exception 'update_platform_organization did not contain the last_renewed_on expression';
  end if;
  execute patched;

  definition := pg_get_functiondef('public.begin_platform_support_session(bigint,text,integer)'::regprocedure);
  patched := replace(definition,
    $old$  update public.platform_support_sessions set ended_at = now()
  where administrator_id = (select auth.uid()) and ended_at is null;$old$,
    $new$  with closed as (
    update public.platform_support_sessions set ended_at = now()
    where administrator_id = (select auth.uid()) and ended_at is null
    returning id, organization_id
  )
  select count(*) into closed_count from (
    select private.write_platform_audit(
      closed.organization_id, 'support.session_ended', 'platform_support_session',
      closed.id::text, 'Cerrada al iniciar otra asistencia', '{}'::jsonb
    ) from closed
  ) audited;$new$);
  patched := replace(patched,
    $old$declare new_session public.platform_support_sessions%rowtype;$old$,
    $new$declare new_session public.platform_support_sessions%rowtype;
  closed_count integer;$new$);
  if patched = definition or position('closed_count integer' in patched) = 0 then
    raise exception 'begin_platform_support_session did not contain the expected fragments';
  end if;
  execute patched;
end;
$$;

-- QA-50: Spanish copy for the prefix lock (code stays check_violation / 23514).
create or replace function private.protect_organization_order_prefix()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.first_order_created_at is not null and new.order_prefix <> old.order_prefix then
    raise exception 'El prefijo de pedidos no puede cambiar después del primer pedido.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- QA-58: owners also read the names of invited and inactive members of their
-- organizations (team list, history actors). Others still see active members only.
alter policy profiles_select_self_or_related on public.profiles
using (
  user_id = (select auth.uid())
  or (select private.is_platform_admin())
  or exists (
    select 1
    from public.organization_memberships mine
    join public.organization_memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = profiles.user_id
      and (theirs.status = 'active' or mine.role = 'owner')
  )
);
