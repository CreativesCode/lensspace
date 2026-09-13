# Catalog and pricing verification

Date: 2026-09-13

## Automated checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; Next.js generated the dynamic `/catalog` route.
- Both catalog migrations were applied to the connected Supabase project.
- The post-migration security advisor reported no new catalog finding. Its two
  existing warnings remain the intentional authenticated member-management RPC
  and disabled leaked-password protection. Performance reported only unused-index
  notices expected for the new, nearly empty pilot schema.

## Remote transactional fixtures

All fixture transactions were rolled back.

- An operational seller calculated a selection containing progressive vision,
  high-index material and treatments against a high prescription. The function
  returned separate CUP and USD totals, the expected explicit CUP equivalent and
  one graduation advisory with its CUP surcharge.
- An owner applied an organization override and the price engine used it. The
  same selection remained mixed-currency and converted only in the summary.
- The seller could calculate prices but an attempted catalog price mutation was
  denied by RLS and did not change the row.
- Initial fixture execution exposed missing authenticated execute permission on
  private RLS helpers. The corrective grant migration was applied and the same
  scenarios then passed.

## Pending

Interactive desktop/mobile inspection of item selection, owner forms and warning
states remains pending because browser automation could not initialize reliably.
No credentials or fixture identities are recorded here.
