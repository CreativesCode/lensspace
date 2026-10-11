# Archive/delete organizations and the platform guide

Date: 2026-10-11

Decisions (product owner):

- Archived = no access for anyone of the organization, data kept, restorable.
  Implemented by a trigger on `organizations.status` that sets the organization's
  invited/active memberships to inactive and stores their previous status in
  `private.archived_memberships`; restoring puts them back. Every access helper
  already requires an active membership, so no RLS function had to change — keep it
  that way for new access paths (always require `membership.status = 'active'`).
- Delete only organizations without activity (`delete_empty_organization`, exact name
  + reason, audited at platform level with organization_id null). With history:
  archive. The owner's auth account is not deleted.
- Manual: third audience `platform` ("Guía de la plataforma"), superadmin only, fixed
  copy in `src/features/client-docs/generators/platformGuide.ts` — update it when the
  admin panel changes. The owner guide gets a fixed "Tu suscripción" section.

Migration `20261011204739_archive_and_delete_organizations.sql`; test
`supabase/tests/archive_and_delete_organizations.sql`.
