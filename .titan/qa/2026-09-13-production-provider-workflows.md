# Production and provider workflow QA

Date: 2026-09-13
Status: database deployed and remotely verified; UI verified statically

- Applied every migration to a disposable PostgreSQL database.
- `supabase/tests/production_provider_workflows.sql` passed locally and remotely
  inside a transaction that rolled back all fixtures.
- Verified role/organization matching, one current job per type, constrained lens
  transitions and provider-only assigned-job visibility.
- Verified another seller cannot read the job.
- Verified append-only events, incident cost responsibility, superseded original
  work and linked current rework.
- Verified authenticated users cannot edit work snapshots or delete events.
- Hosted advisors reported no new warning or error.
- `/production` follows the workshop composition in `docs/design/Vision Studio.dc.html`.
- Provider payloads omit customer identity, accepted prices and payment data.
- `npm run typecheck`, `npm run lint` and `npm run build` passed.

Interactive seller/owner/provider browser QA requires active invited provider
accounts and remains pending.
