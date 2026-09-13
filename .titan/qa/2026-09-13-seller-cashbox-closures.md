# Seller cashboxes and closures QA

Date: 2026-09-13
Status: deployed and remotely verified

## Verified database behavior

- Applied every repository migration, including
  `20260913161712_seller_cashboxes_and_closures.sql`, in order to a disposable
  PostgreSQL database with Supabase Auth/Storage compatibility stubs.
- Ran `supabase/tests/cashbox_closures.sql` transactionally.
- A 400 CUP payment was allocated once to the primary closure.
- Expected 400, declared 390 and difference -10 were preserved exactly.
- A later 100 CUP payment succeeded and was marked `is_post_close`.
- Complementary closure 1 allocated only that late payment.
- Consolidated expected amount was 500 CUP without changing the primary closure.
- Another seller could not read the cashbox; the organization owner could.
- Updates to closures and deletes from allocations raised SQLSTATE `55000`.
- The fixture rolled back all test data.

## Application verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; Next.js generated `/cashbox` as a dynamic route.
- `git diff --check`: passed (line-ending notices only).

## Hosted verification

- The dry run listed only the cashbox migration; it then applied successfully.
- The same fixture passed remotely and rolled back all data.
- Advisors reported no new finding. The two existing warnings remain: the
  intentional member-management `SECURITY DEFINER` RPC and disabled leaked-password
  protection.

Interactive responsive QA remains pending.
