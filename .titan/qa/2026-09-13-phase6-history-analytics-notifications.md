# Phase 6 QA — history, analytics and manual notifications

Date: 2026-09-13

## Verified

- Migration `20260913181347_phase6_history_analytics_notifications.sql` applied
  successfully to the linked Supabase project and appears in remote history.
- Remote transactional fixture `phase6_history_analytics_notifications.sql` passed
  and rolled back. It verifies timeline composition, actor access isolation, owner
  totals (1,000 CUP sales, 250 CUP collections, 750 CUP balance), recipient snapshot,
  manual-provider outcome and immutable attempt enforcement.
- Supabase advisors completed without errors. The only warnings are the previously
  accepted member-management `SECURITY DEFINER` RPC and disabled leaked-password
  protection.
- `npm run lint`, `npm run typecheck`, `npm run build` and `git diff --check` passed.
- Unauthenticated HTTP checks returned 307 to `/login` for `/production`, `/orders`
  and `/dashboard`; `/login` returned 200.

## Blocked coverage

- No browser surface was available to the UI automation integration.
- No real role credentials were available. Interactive authenticated desktop/mobile
  behavior for owner, seller and both provider roles remains pending and is not
  reported as passing.

