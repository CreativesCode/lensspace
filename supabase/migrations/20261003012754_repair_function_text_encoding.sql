-- QA-43: some deployed function bodies were applied with the wrong client encoding,
-- so UTF-8 accents became two Latin-1 characters ("organizaciÃ³n"). Rebuild every
-- affected definition by folding each 'Ã' + continuation byte back into its letter.
-- chr() keeps this file immune to the same client-encoding problem.
do $$
declare
  fn record;
  definition text;
  byte int;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and (p.prosrc like '%' || chr(195) || '%'
        or p.prosrc like '%El historial de produccion es inmutable.%'
        or p.prosrc like '%Responsabilidad de costo no valida.%')
  loop
    definition := pg_get_functiondef(fn.oid);
    for byte in 128..191 loop
      definition := replace(definition, chr(195) || chr(byte), chr(byte + 64));
    end loop;
    definition := replace(definition, 'El historial de produccion es inmutable.', 'El historial de producción es inmutable.');
    definition := replace(definition, 'Responsabilidad de costo no valida.', 'Responsabilidad de costo no válida.');
    execute definition;
  end loop;
end;
$$;

-- Stored attempt messages copied the broken text. The history is append-only, so the
-- guard is lifted only for this one-off repair.
alter table public.notification_attempts disable trigger notification_attempts_immutable;
do $$
declare
  byte int;
begin
  for byte in 128..191 loop
    update public.notification_attempts
    set failure_message = replace(failure_message, chr(195) || chr(byte), chr(byte + 64))
    where failure_message like '%' || chr(195) || chr(byte) || '%';
  end loop;
end;
$$;
alter table public.notification_attempts enable trigger notification_attempts_immutable;
