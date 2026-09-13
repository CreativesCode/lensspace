-- Tenant-aware catalog, exact multi-currency pricing and advisory graduation rules.

create table public.catalog_items (
  id bigint generated always as identity primary key,
  organization_id bigint references public.organizations(id),
  category text not null check (
    category in ('vision_type', 'lens_material', 'treatment', 'frame', 'mounting', 'adjustment')
  ),
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,49}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text,
  cost_amount numeric(12,2) not null default 0 check (cost_amount >= 0),
  sale_price numeric(12,2) not null check (sale_price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index catalog_items_base_code_key
  on public.catalog_items (code)
  where organization_id is null;
create unique index catalog_items_organization_code_key
  on public.catalog_items (organization_id, code)
  where organization_id is not null;
create index catalog_items_organization_category_idx
  on public.catalog_items (organization_id, category, name)
  where is_active;
create index catalog_items_created_by_idx
  on public.catalog_items (created_by)
  where created_by is not null;

create table public.catalog_item_overrides (
  organization_id bigint not null references public.organizations(id),
  catalog_item_id bigint not null references public.catalog_items(id),
  cost_amount numeric(12,2) not null check (cost_amount >= 0),
  sale_price numeric(12,2) not null check (sale_price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  is_enabled boolean not null default true,
  changed_by uuid not null references public.profiles(user_id),
  changed_at timestamptz not null default now(),
  primary key (organization_id, catalog_item_id)
);
create index catalog_item_overrides_item_idx
  on public.catalog_item_overrides (catalog_item_id);
create index catalog_item_overrides_changed_by_idx
  on public.catalog_item_overrides (changed_by);

create table public.catalog_item_compatibilities (
  id bigint generated always as identity primary key,
  organization_id bigint references public.organizations(id),
  left_item_id bigint not null references public.catalog_items(id),
  right_item_id bigint not null references public.catalog_items(id),
  is_allowed boolean not null default true,
  message text not null check (char_length(btrim(message)) between 4 and 300),
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (left_item_id < right_item_id)
);
create unique index catalog_compatibilities_base_pair_key
  on public.catalog_item_compatibilities (left_item_id, right_item_id)
  where organization_id is null;
create unique index catalog_compatibilities_organization_pair_key
  on public.catalog_item_compatibilities (organization_id, left_item_id, right_item_id)
  where organization_id is not null;
create index catalog_compatibilities_right_item_idx
  on public.catalog_item_compatibilities (right_item_id);
create index catalog_compatibilities_created_by_idx
  on public.catalog_item_compatibilities (created_by)
  where created_by is not null;

create table public.graduation_rules (
  id bigint generated always as identity primary key,
  organization_id bigint references public.organizations(id),
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,49}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  applies_to_item_id bigint references public.catalog_items(id),
  recommended_item_id bigint references public.catalog_items(id),
  minimum_absolute_sphere numeric(5,2) check (minimum_absolute_sphere between 0 and 40),
  minimum_absolute_cylinder numeric(5,2) check (minimum_absolute_cylinder between 0 and 20),
  minimum_addition numeric(4,2) check (minimum_addition between 0 and 8),
  surcharge_amount numeric(12,2) not null default 0 check (surcharge_amount >= 0),
  surcharge_currency text check (surcharge_currency is null or surcharge_currency ~ '^[A-Z]{3}$'),
  message text not null check (char_length(btrim(message)) between 8 and 500),
  is_active boolean not null default true,
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    minimum_absolute_sphere is not null
    or minimum_absolute_cylinder is not null
    or minimum_addition is not null
  ),
  check (
    (surcharge_amount = 0 and surcharge_currency is null)
    or (surcharge_amount > 0 and surcharge_currency is not null)
  )
);
create unique index graduation_rules_base_code_key
  on public.graduation_rules (code)
  where organization_id is null;
create unique index graduation_rules_organization_code_key
  on public.graduation_rules (organization_id, code)
  where organization_id is not null;
create index graduation_rules_applies_item_idx
  on public.graduation_rules (applies_to_item_id)
  where is_active;
create index graduation_rules_recommended_item_idx
  on public.graduation_rules (recommended_item_id)
  where recommended_item_id is not null;
create index graduation_rules_created_by_idx
  on public.graduation_rules (created_by)
  where created_by is not null;

create trigger catalog_items_set_updated_at
before update on public.catalog_items
for each row execute function private.set_updated_at();
create trigger catalog_compatibilities_set_updated_at
before update on public.catalog_item_compatibilities
for each row execute function private.set_updated_at();
create trigger graduation_rules_set_updated_at
before update on public.graduation_rules
for each row execute function private.set_updated_at();

create or replace function private.has_commercial_catalog_access(
  target_organization_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_platform_admin()
    or exists (
      select 1
      from public.organization_memberships membership
      join public.profiles profile
        on profile.user_id = membership.user_id
        and profile.is_active
      where membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('owner', 'seller')
        and (
          target_organization_id is null
          or membership.organization_id = target_organization_id
        )
    );
$$;

create or replace function private.can_manage_commercial_catalog(
  target_organization_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_platform_admin()
    or (
      target_organization_id is not null
      and private.has_organization_role(target_organization_id, array['owner'])
      and private.can_operate_in_organization(target_organization_id, 'optical_sales')
    );
$$;

revoke all on function private.has_commercial_catalog_access(bigint)
from public, anon, authenticated;
revoke all on function private.can_manage_commercial_catalog(bigint)
from public, anon, authenticated;

alter table public.catalog_items enable row level security;
alter table public.catalog_item_overrides enable row level security;
alter table public.catalog_item_compatibilities enable row level security;
alter table public.graduation_rules enable row level security;

create policy catalog_items_select_commercial
on public.catalog_items for select to authenticated
using (
  (select private.has_commercial_catalog_access(organization_id))
);
create policy catalog_items_insert_managed
on public.catalog_items for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.can_manage_commercial_catalog(organization_id))
);
create policy catalog_items_update_managed
on public.catalog_items for update to authenticated
using ((select private.can_manage_commercial_catalog(organization_id)))
with check ((select private.can_manage_commercial_catalog(organization_id)));

create policy catalog_overrides_select_commercial
on public.catalog_item_overrides for select to authenticated
using ((select private.has_commercial_catalog_access(organization_id)));
create policy catalog_overrides_insert_managed
on public.catalog_item_overrides for insert to authenticated
with check (
  changed_by = (select auth.uid())
  and (select private.can_manage_commercial_catalog(organization_id))
);
create policy catalog_overrides_update_managed
on public.catalog_item_overrides for update to authenticated
using ((select private.can_manage_commercial_catalog(organization_id)))
with check (
  changed_by = (select auth.uid())
  and (select private.can_manage_commercial_catalog(organization_id))
);

create policy catalog_compatibilities_select_commercial
on public.catalog_item_compatibilities for select to authenticated
using ((select private.has_commercial_catalog_access(organization_id)));
create policy catalog_compatibilities_insert_managed
on public.catalog_item_compatibilities for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.can_manage_commercial_catalog(organization_id))
);
create policy catalog_compatibilities_update_managed
on public.catalog_item_compatibilities for update to authenticated
using ((select private.can_manage_commercial_catalog(organization_id)))
with check ((select private.can_manage_commercial_catalog(organization_id)));

create policy graduation_rules_select_commercial
on public.graduation_rules for select to authenticated
using ((select private.has_commercial_catalog_access(organization_id)));
create policy graduation_rules_insert_managed
on public.graduation_rules for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.can_manage_commercial_catalog(organization_id))
);
create policy graduation_rules_update_managed
on public.graduation_rules for update to authenticated
using ((select private.can_manage_commercial_catalog(organization_id)))
with check ((select private.can_manage_commercial_catalog(organization_id)));

revoke all on public.catalog_items from anon, authenticated;
revoke all on public.catalog_item_overrides from anon, authenticated;
revoke all on public.catalog_item_compatibilities from anon, authenticated;
revoke all on public.graduation_rules from anon, authenticated;

grant select, insert on public.catalog_items to authenticated;
grant update (category, code, name, description, cost_amount, sale_price, currency, is_active)
on public.catalog_items to authenticated;
grant select, insert on public.catalog_item_overrides to authenticated;
grant update (cost_amount, sale_price, currency, is_enabled, changed_by, changed_at)
on public.catalog_item_overrides to authenticated;
grant select, insert on public.catalog_item_compatibilities to authenticated;
grant update (is_allowed, message) on public.catalog_item_compatibilities to authenticated;
grant select, insert on public.graduation_rules to authenticated;
grant update (
  code, name, applies_to_item_id, recommended_item_id,
  minimum_absolute_sphere, minimum_absolute_cylinder, minimum_addition,
  surcharge_amount, surcharge_currency, message, is_active
) on public.graduation_rules to authenticated;

grant usage, select on sequence public.catalog_items_id_seq to authenticated;
grant usage, select on sequence public.catalog_item_compatibilities_id_seq to authenticated;
grant usage, select on sequence public.graduation_rules_id_seq to authenticated;

create or replace function public.calculate_catalog_price(
  target_organization_id bigint,
  selected_item_ids bigint[],
  target_prescription_revision_id bigint,
  usd_to_cup_rate numeric
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  item_record record;
  rule_record record;
  compatibility_record record;
  selected_count integer;
  resolved_count integer := 0;
  line_items jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;
  totals jsonb := '{}'::jsonb;
  current_total numeric(14,2);
  max_sphere numeric := 0;
  max_cylinder numeric := 0;
  max_addition numeric := 0;
  cup_equivalent numeric(14,2);
begin
  if not (
    private.has_organization_role(target_organization_id, array['owner', 'seller'])
    or private.is_platform_admin()
  ) or not private.can_operate_in_organization(target_organization_id, 'optical_sales')
  then
    raise exception using errcode = '42501', message = 'No puedes calcular precios para esta organización.';
  end if;

  selected_count := coalesce(cardinality(selected_item_ids), 0);
  if selected_count not between 1 and 20
    or selected_count <> (select count(distinct value) from unnest(selected_item_ids) value)
  then
    raise exception using errcode = '22023', message = 'Selecciona entre uno y veinte artículos sin repetir.';
  end if;

  if usd_to_cup_rate is not null and usd_to_cup_rate <= 0 then
    raise exception using errcode = '22023', message = 'La tasa USD/CUP debe ser positiva.';
  end if;

  if target_prescription_revision_id is not null then
    select
      greatest(abs(coalesce(right_sphere, 0)), abs(coalesce(left_sphere, 0))),
      greatest(abs(coalesce(right_cylinder, 0)), abs(coalesce(left_cylinder, 0))),
      greatest(coalesce(right_addition, 0), coalesce(left_addition, 0))
    into max_sphere, max_cylinder, max_addition
    from public.prescription_revisions
    where id = target_prescription_revision_id
      and organization_id = target_organization_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'La revisión de receta no está disponible.';
    end if;
  end if;

  for item_record in
    select
      item.id,
      item.code,
      item.name,
      item.category,
      coalesce(override.sale_price, item.sale_price) as sale_price,
      coalesce(override.currency, item.currency) as currency
    from public.catalog_items item
    left join public.catalog_item_overrides override
      on override.catalog_item_id = item.id
      and override.organization_id = target_organization_id
    where item.id = any(selected_item_ids)
      and item.is_active
      and (item.organization_id is null or item.organization_id = target_organization_id)
      and coalesce(override.is_enabled, true)
    order by item.category, item.name
  loop
    resolved_count := resolved_count + 1;
    line_items := line_items || jsonb_build_array(jsonb_build_object(
      'kind', 'catalog_item',
      'itemId', item_record.id,
      'code', item_record.code,
      'name', item_record.name,
      'category', item_record.category,
      'amount', item_record.sale_price,
      'currency', item_record.currency
    ));
    current_total := coalesce((totals ->> item_record.currency)::numeric, 0) + item_record.sale_price;
    totals := jsonb_set(totals, array[item_record.currency], to_jsonb(current_total), true);
  end loop;

  if resolved_count <> selected_count then
    raise exception using errcode = '22023', message = 'Uno o más artículos no están disponibles para esta organización.';
  end if;

  for compatibility_record in
    select distinct on (compatibility.left_item_id, compatibility.right_item_id)
      compatibility.message,
      compatibility.is_allowed,
      compatibility.left_item_id,
      compatibility.right_item_id
    from public.catalog_item_compatibilities compatibility
    where compatibility.left_item_id = any(selected_item_ids)
      and compatibility.right_item_id = any(selected_item_ids)
      and (compatibility.organization_id is null or compatibility.organization_id = target_organization_id)
    order by
      compatibility.left_item_id,
      compatibility.right_item_id,
      (compatibility.organization_id = target_organization_id) desc
  loop
    if not compatibility_record.is_allowed then
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'kind', 'compatibility',
        'message', compatibility_record.message,
        'blocking', false
      ));
    end if;
  end loop;

  if target_prescription_revision_id is not null then
    for rule_record in
      select distinct on (rule.code)
        rule.*,
        recommended.name as recommended_name
      from public.graduation_rules rule
      left join public.catalog_items recommended on recommended.id = rule.recommended_item_id
      where rule.is_active
        and (rule.organization_id is null or rule.organization_id = target_organization_id)
        and (rule.applies_to_item_id is null or rule.applies_to_item_id = any(selected_item_ids))
        and (rule.minimum_absolute_sphere is null or max_sphere >= rule.minimum_absolute_sphere)
        and (rule.minimum_absolute_cylinder is null or max_cylinder >= rule.minimum_absolute_cylinder)
        and (rule.minimum_addition is null or max_addition >= rule.minimum_addition)
      order by rule.code, (rule.organization_id = target_organization_id) desc
    loop
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'kind', 'graduation_rule',
        'ruleCode', rule_record.code,
        'message', rule_record.message,
        'recommendedItemId', rule_record.recommended_item_id,
        'recommendedItemName', rule_record.recommended_name,
        'blocking', false
      ));

      if rule_record.surcharge_amount > 0 then
        line_items := line_items || jsonb_build_array(jsonb_build_object(
          'kind', 'graduation_surcharge',
          'ruleCode', rule_record.code,
          'name', rule_record.name,
          'amount', rule_record.surcharge_amount,
          'currency', rule_record.surcharge_currency
        ));
        current_total := coalesce((totals ->> rule_record.surcharge_currency)::numeric, 0)
          + rule_record.surcharge_amount;
        totals := jsonb_set(
          totals,
          array[rule_record.surcharge_currency],
          to_jsonb(current_total),
          true
        );
      end if;
    end loop;
  end if;

  if usd_to_cup_rate is not null then
    cup_equivalent := coalesce((totals ->> 'CUP')::numeric, 0)
      + coalesce((totals ->> 'USD')::numeric, 0) * usd_to_cup_rate;
  end if;

  return jsonb_build_object(
    'lineItems', line_items,
    'totals', totals,
    'usdToCupRate', usd_to_cup_rate,
    'cupEquivalent', cup_equivalent,
    'warnings', warnings,
    'clinicalMetrics', jsonb_build_object(
      'maximumAbsoluteSphere', max_sphere,
      'maximumAbsoluteCylinder', max_cylinder,
      'maximumAddition', max_addition
    )
  );
end;
$$;

revoke all on function public.calculate_catalog_price(bigint, bigint[], bigint, numeric)
from public, anon;
grant execute on function public.calculate_catalog_price(bigint, bigint[], bigint, numeric)
to authenticated;

insert into public.catalog_items (category, code, name, description, cost_amount, sale_price, currency)
values
  ('vision_type', 'near', 'Cerca', 'Espejuelo para visión cercana.', 900, 1800, 'CUP'),
  ('vision_type', 'distance', 'Lejos', 'Espejuelo para visión lejana.', 1050, 2100, 'CUP'),
  ('vision_type', 'bifocal', 'Bifocal', 'Dos zonas de visión.', 2300, 4500, 'CUP'),
  ('vision_type', 'progressive', 'Progresivo', 'Progresión continua de visión.', 2600, 5000, 'CUP'),
  ('lens_material', 'cr39', 'CR-39 1.50', 'Material orgánico estándar.', 700, 1400, 'CUP'),
  ('lens_material', 'polycarbonate', 'Policarbonato 1.59', 'Ligero y resistente a impactos.', 1100, 2200, 'CUP'),
  ('lens_material', 'high_index_167', 'Alto índice 1.67', 'Perfil reducido para graduaciones altas.', 1900, 3800, 'CUP'),
  ('treatment', 'anti_reflective', 'Antirreflejo', 'Tratamiento antirreflejo.', 600, 1400, 'CUP'),
  ('treatment', 'blue_filter', 'Filtro azul', 'Filtro para luz azul.', 9, 20, 'USD'),
  ('treatment', 'photochromic', 'Fotocromático', 'Oscurecimiento por radiación UV.', 1400, 2900, 'CUP'),
  ('treatment', 'hardened', 'Endurecido', 'Protección superficial.', 300, 700, 'CUP'),
  ('mounting', 'standard_mounting', 'Montaje', 'Montaje estándar de cristales.', 350, 900, 'CUP');

insert into public.graduation_rules (
  code,
  name,
  applies_to_item_id,
  recommended_item_id,
  minimum_absolute_sphere,
  surcharge_amount,
  surcharge_currency,
  message
)
select
  'progressive_high_power',
  'Recargo por graduación alta',
  progressive.id,
  high_index.id,
  4.00,
  900,
  'CUP',
  'Por la graduación, considera alto índice 1.67. La recomendación es orientativa y puedes continuar.'
from public.catalog_items progressive
cross join public.catalog_items high_index
where progressive.code = 'progressive'
  and progressive.organization_id is null
  and high_index.code = 'high_index_167'
  and high_index.organization_id is null;
