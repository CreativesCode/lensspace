-- Retry-safe customer creation (QA-03 item 4): the client sends one request id per
-- attempt and reuses it on retry, so a lost response never creates the customer
-- twice. A separate overload (the key has no default) keeps existing callers and
-- avoids PostgREST overload ambiguity.

alter table public.customers add column client_request_id uuid;

create unique index customers_created_by_client_request_key
  on public.customers (created_by, client_request_id)
  where client_request_id is not null;

grant select (client_request_id), insert (client_request_id) on public.customers to authenticated;

create or replace function public.create_customer_with_phones(
  target_organization_id bigint,
  target_branch_id bigint,
  customer_full_name text,
  customer_request_id uuid,
  customer_national_id text default null,
  customer_address text default null,
  customer_birth_date date default null,
  customer_notes text default null,
  customer_messaging_consent boolean default false,
  phone_entries jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
set search_path to ''
as $function$
declare
  actor_user_id uuid := (select auth.uid());
  new_customer_id bigint;
  phone_entry jsonb;
  phone_position integer := 0;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión para registrar clientes.';
  end if;
  if customer_request_id is null then
    raise exception using errcode = '22023', message = 'Falta el identificador de la solicitud.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_user_id::text || ':customer:' || customer_request_id::text, 0));
  select id into new_customer_id
  from public.customers
  where created_by = actor_user_id and client_request_id = customer_request_id;
  if new_customer_id is not null then
    return new_customer_id;
  end if;

  if jsonb_typeof(phone_entries) is distinct from 'array'
    or jsonb_array_length(phone_entries) not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Registra entre uno y cinco teléfonos.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(phone_entries) entry
    where jsonb_typeof(entry) is distinct from 'object'
      or nullif(btrim(entry ->> 'number'), '') is null
  ) then
    raise exception using errcode = '22023', message = 'Cada teléfono debe incluir un número válido.';
  end if;
  if exists (
    select 1
    from (
      select regexp_replace(entry ->> 'number', '[^0-9]', '', 'g') as normalized
      from jsonb_array_elements(phone_entries) entry
    ) normalized_entries
    group by normalized
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'No repitas el mismo teléfono en la ficha.';
  end if;

  insert into public.customers (
    organization_id, branch_id, full_name, national_id, address, birth_date,
    notes, messaging_consent, created_by, client_request_id
  ) values (
    target_organization_id, target_branch_id, btrim(customer_full_name),
    nullif(btrim(customer_national_id), ''), nullif(btrim(customer_address), ''),
    customer_birth_date, nullif(btrim(customer_notes), ''),
    customer_messaging_consent, actor_user_id, customer_request_id
  ) returning id into new_customer_id;

  for phone_entry in select value from jsonb_array_elements(phone_entries)
  loop
    phone_position := phone_position + 1;
    insert into public.customer_phones (
      organization_id, branch_id, customer_id, label, phone_number,
      is_primary, whatsapp_enabled
    ) values (
      target_organization_id, target_branch_id, new_customer_id,
      coalesce(nullif(btrim(phone_entry ->> 'label'), ''), 'principal'),
      btrim(phone_entry ->> 'number'), phone_position = 1,
      coalesce((phone_entry ->> 'whatsappEnabled')::boolean, true)
    );
  end loop;
  return new_customer_id;
end;
$function$;

revoke all on function public.create_customer_with_phones(bigint, bigint, text, uuid, text, text, date, text, boolean, jsonb) from public, anon;
grant execute on function public.create_customer_with_phones(bigint, bigint, text, uuid, text, text, date, text, boolean, jsonb) to authenticated;
