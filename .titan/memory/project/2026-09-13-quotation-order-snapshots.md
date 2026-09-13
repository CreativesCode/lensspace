# Quotation acceptance and immutable order snapshots

Date: 2026-09-13

## Decision

- A quotation is an editable current proposal, not a chain of stored versions.
- Acceptance is verbal and atomic. The database recalculates against the current
  catalog; changed prices reject acceptance and require the seller to refresh and
  reconfirm with the customer.
- An accepted order snapshots every line, original currency, totals and the
  seller-selected USD-to-CUP rate. Snapshot lines and confirmations are immutable.
- Order numbers use the organization's locked prefix and an independent yearly
  counter in `ORG-YEAR-000001` form.
- Sellers see and mutate only their own branch sales; owners can access their
  organization's sales. External providers and unrelated tenants are excluded.

## Implementation and evidence

Migrations `20260913153724_quotation_order_snapshots.sql`,
`20260913154605_deny_direct_order_counter_access.sql` and
`20260913154709_index_quotation_order_foreign_keys.sql` add quotation/order tables,
RLS, atomic save/accept functions, numbering and immutable guards. `/sales`
implements customer, optional prescription, catalog selection, price review and
acceptance. Remote rollback-only fixtures verified successful acceptance,
numbering, one confirmation, snapshot immutability and rejection after a catalog
price change. TypeScript, ESLint and production build passed.

Payments, balances, delivery guards and cashbox closures remain the next Phase 4
block. Interactive responsive browser QA remains pending.
