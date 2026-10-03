-- QA-43 guard: no function body may contain double-encoded UTF-8 ('Ã' + byte).
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosrc like '%' || chr(195) || '%'
  ) then
    raise exception 'Mojibake found in a public/private function body; re-apply it as UTF-8.';
  end if;
end;
$$;
