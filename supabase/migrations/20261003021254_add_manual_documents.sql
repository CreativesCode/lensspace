-- QA-64: the user manual is edited only by the platform superadmin and read by every
-- signed-in user. One row per manual (today only 'main'); the content is the
-- generator input (ClientDocsInput) so pages and PDF are rendered from it. With no
-- row, the app falls back to the bundled default content.
create table public.manual_documents (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 512000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.manual_documents enable row level security;

create policy manual_documents_select_authenticated on public.manual_documents
for select to authenticated
using (true);

create policy manual_documents_insert_platform_admin on public.manual_documents
for insert to authenticated
with check ((select private.is_platform_admin()));

create policy manual_documents_update_platform_admin on public.manual_documents
for update to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));

revoke all on public.manual_documents from anon;
grant select, insert, update on public.manual_documents to authenticated;

create trigger manual_documents_set_updated_at
before update on public.manual_documents
for each row execute function private.set_updated_at();
