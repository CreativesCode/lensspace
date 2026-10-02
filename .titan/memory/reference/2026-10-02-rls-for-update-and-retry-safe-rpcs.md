# RLS with FOR UPDATE and retry-safe RPCs

Date: 2026-10-02

- In SECURITY INVOKER functions, `SELECT ... FOR UPDATE` is filtered by the table's
  UPDATE policy, not only SELECT. `quotations_update` excludes `status = 'accepted'`,
  so an accepted quotation looks "not found" under FOR UPDATE. Look up already-done
  results with a plain SELECT (see `accept_quotation`, migration 20261002165428).
- Pattern for writes that must survive lost responses on Cuban links: the client
  generates one UUID per attempt (reused on retry, reset on success or input change),
  the RPC takes `*_request_id uuid`, takes `pg_advisory_xact_lock` on the key and
  returns the existing row (`duplicate: true`) before inserting; a partial unique
  index backs it (`payments_order_client_request_key`). Network errors from
  supabase-js have no `code`; detect them with `isNetworkError` in
  `src/features/orders/payment-errors.ts`.
- Recreating an RPC with a new parameter needs DROP + CREATE (not CREATE OR REPLACE);
  re-apply grants to `authenticated`, `service_role` only.
- Migrations applied outside `apply_migration` are not recorded in
  `supabase_migrations.schema_migrations`; record them with
  `supabase migration repair --status applied <version>`.
