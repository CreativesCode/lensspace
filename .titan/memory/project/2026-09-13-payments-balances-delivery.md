# Cash payments, balances and delivery

Date: 2026-09-13

## Decisions

- MVP payments are cash only and immutable; refunds and cancellation remain out
  of scope.
- Every payment stores its amount/currency, applied rate, generated CUP equivalent,
  receiver and timestamp. CUP payments use rate 1; USD payments retain the rate
  actually applied.
- The order's CUP-equivalent total is the common balance basis. Every accepted
  sale must therefore snapshot a positive USD-to-CUP rate, including CUP-only
  sales, so later additions retain a stable valuation basis.
- Overpayments are rejected. Payment status is derived after each insert.
- Delivery is a database invariant: an accepted order cannot transition to
  delivered while any CUP-equivalent balance remains. There is no override.

## Implementation and evidence

Migrations `20260913155559_cash_payments_balances_delivery_guard.sql` and
`20260913155822_require_sale_exchange_snapshot.sql` add payments, balance RPCs,
transition guards and mandatory sale-rate snapshots. `/orders` provides the
seller/owner order tray, payment history, CUP/USD cash capture and guarded delivery.
Rollback-only remote fixtures verified partial mixed-currency payment, exact final
balance, automatic status, overpayment rejection and zero-balance delivery.

Seller cashbox and primary/complementary closures are the next Phase 4 block. Its
executable scope and acceptance criteria are recorded in
`reference/2026-09-13-next-work.md`.
