# Seller cashboxes and immutable closures

Date: 2026-09-13
Status: deployed and remotely verified

Each cash receipt belongs to one daily cashbox identified by organization,
branch, receiving seller, organization-local business date and currency. Payment
insertion derives that identity in the database and never trusts client-supplied
receiver, date, cashbox or post-close state.

Primary and complementary closures serialize with payment insertion by locking
the same cashbox row. A primary closure allocates all eligible receipts once. A
later receipt remains valid, is marked post-close and can only be allocated by a
sequential complementary closure. Expected, declared and difference amounts and
their payment allocations are immutable.

Sellers read and close only their own cashboxes. Owners review organization data
with date, branch and seller filters. External providers and unrelated users have
no access. Subscription and Cashbox-module state guard all mutations.

Evidence: `supabase/migrations/20260913161712_seller_cashboxes_and_closures.sql`,
`supabase/tests/cashbox_closures.sql` and
`.titan/qa/2026-09-13-seller-cashbox-closures.md`.

No credentials or private fixture data are stored here.
