-- QA-20: '50000101' and '+53 5000 0101' were stored as different normalized numbers,
-- so duplicate checks missed them and WhatsApp needs the country code anyway.
-- An 8-digit Cuban number is normalized with the 53 prefix; the generated column is
-- recomputed for existing rows (PostgreSQL 17 SET EXPRESSION).
alter table public.customer_phones
  alter column normalized_phone set expression as (
    case
      when length(regexp_replace(phone_number, '[^0-9]', '', 'g')) = 8
        then '53' || regexp_replace(phone_number, '[^0-9]', '', 'g')
      else regexp_replace(phone_number, '[^0-9]', '', 'g')
    end
  );
