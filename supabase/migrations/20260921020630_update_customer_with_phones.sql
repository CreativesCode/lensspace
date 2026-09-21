create policy customer_phones_delete_branch_clinical
on public.customer_phones for delete to authenticated
using (
  (select private.can_write_branch_clinical_data(organization_id, branch_id))
);

grant delete on public.customer_phones to authenticated;

create function public.update_customer_with_phones(
  target_customer_id bigint,
  customer_full_name text,
  customer_national_id text default null,
  customer_address text default null,
  customer_birth_date date default null,
  customer_notes text default null,
  customer_messaging_consent boolean default false,
  phone_entries jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  customer_record public.customers%rowtype;
  phone_entry jsonb;
  phone_position integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión para editar clientes.';
  end if;
  if char_length(btrim(coalesce(customer_full_name, ''))) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'El nombre debe tener entre 2 y 160 caracteres.';
  end if;
  if jsonb_typeof(phone_entries) is distinct from 'array'
    or jsonb_array_length(phone_entries) not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Registra entre uno y cinco teléfonos.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(phone_entries) entry
    where jsonb_typeof(entry) is distinct from 'object'
      or char_length(btrim(coalesce(entry ->> 'number', ''))) not between 5 and 40
      or regexp_replace(entry ->> 'number', '[^0-9]', '', 'g') !~ '^[0-9]{5,20}$'
  ) then
    raise exception using errcode = '22023', message = 'Cada teléfono debe contener entre 5 y 20 dígitos.';
  end if;
  if exists (
    select 1
    from (
      select regexp_replace(entry ->> 'number', '[^0-9]', '', 'g') normalized
      from jsonb_array_elements(phone_entries) entry
    ) entries
    group by normalized having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'No repitas el mismo teléfono en la ficha.';
  end if;

  update public.customers
  set full_name = btrim(customer_full_name),
      national_id = nullif(btrim(customer_national_id), ''),
      address = nullif(btrim(customer_address), ''),
      birth_date = customer_birth_date,
      notes = nullif(btrim(customer_notes), ''),
      messaging_consent = customer_messaging_consent
  where id = target_customer_id and archived_at is null
  returning * into customer_record;

  if not found then
    raise exception using errcode = 'P0002', message = 'Cliente no encontrado o sin permiso para editarlo.';
  end if;

  delete from public.customer_phones where customer_id = customer_record.id;
  for phone_entry in select value from jsonb_array_elements(phone_entries) loop
    phone_position := phone_position + 1;
    insert into public.customer_phones (
      organization_id, branch_id, customer_id, label, phone_number, is_primary, whatsapp_enabled
    ) values (
      customer_record.organization_id,
      customer_record.branch_id,
      customer_record.id,
      coalesce(nullif(btrim(phone_entry ->> 'label'), ''), case when phone_position = 1 then 'Principal' else 'Otro' end),
      btrim(phone_entry ->> 'number'),
      phone_position = 1,
      coalesce((phone_entry ->> 'whatsappEnabled')::boolean, true)
    );
  end loop;
  return customer_record.id;
end;
$$;

revoke all on function public.update_customer_with_phones(bigint, text, text, text, date, text, boolean, jsonb) from public, anon;
grant execute on function public.update_customer_with_phones(bigint, text, text, text, date, text, boolean, jsonb) to authenticated;
