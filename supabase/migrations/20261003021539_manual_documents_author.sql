-- QA-64: the server records who published the manual; the client cannot spoof it.
create or replace function private.set_manual_document_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger manual_documents_set_updated_at
before insert or update on public.manual_documents
for each row execute function private.set_manual_document_author();
