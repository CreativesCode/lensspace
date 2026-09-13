# Payments, balances and delivery verification

Date: 2026-09-13

- Remote migrations applied and local filenames match remote migration versions.
- A rollback-only seller fixture created and accepted a temporary order.
- Delivery with an unpaid balance raised the expected database error.
- A partial CUP payment and final USD payment stored their original amounts,
  currencies, rates and generated CUP equivalents.
- The final payment changed the order from partial to paid with zero balance.
- An attempted overpayment was rejected and did not create a payment.
- Delivery succeeded only after the balance reached zero.
- All fixture rows and counter changes were rolled back.
- TypeScript, ESLint and production build passed with `/orders` included.
- Supabase advisors found no new structural security or missing-index issue;
  unused-index notices are expected on the empty pilot schema.
- Interactive responsive browser QA remains pending.
