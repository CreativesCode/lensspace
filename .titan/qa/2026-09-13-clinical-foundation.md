# Clinical foundation verification

Date: 2026-09-13

## Deployed scope

- Branch-owned customers with optional identifier, address, birth date, notes and
  messaging consent.
- Multiple labeled phone records per customer. Phone numbers are normalized by
  PostgreSQL and intentionally remain non-unique.
- Stable prescription identities with append-only numbered clinical revisions.
- File metadata constrained to a prescription and its exact revision, tenant and
  branch.
- Exact numeric fields for sphere, cylinder, addition, prism, pupillary distance
  and height, plus axis and prism base constraints.

## Transactional remote checks

- An active seller inserted and read clinical data in their own branch.
- The same seller could not read a customer in another branch.
- An unrelated authenticated actor saw zero customers and could not insert one.
- Two customers sharing the same normalized phone were retained and discoverable
  as duplicate candidates.
- Two prescription revisions were preserved and the authenticated role had no
  update or delete privilege on revisions.
- The full fixture was rolled back.

## Advisor state

- No unindexed foreign-key findings remain after the covering-index migration.
- New empty-table indexes are reported as unused, which is expected before pilot
  traffic.
- The existing authenticated member-management RPC and leaked-password setting
  warnings remain unchanged.
