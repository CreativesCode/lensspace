# Multi-branch: admin-managed branches and operational rule

Date: 2026-10-10

Product owner decisions: only the platform admin creates, edits, activates or
deactivates branches (from /organizations); a seller works in one branch; customers
stay per branch; one order sequence per organization.

- Active branches ≤ 1 + `extra_branches` of the signed license contract
  (`private.branch_limit`).
- Writes require `private.is_operational_branch`: active branch, and primary or the
  `multi_branch` module enabled. It is part of `can_write_branch_clinical_data` and
  `can_write_seller_sale`; any new branch-scoped write path must go through them.
- Every organization has one `branches.is_primary`. A trigger marks the first branch
  as primary because onboarding inserts it without the flag — without it a new
  organization is read-only (caught before release).
- Branches are written only through the admin RPCs; direct insert/update is revoked.

Plan: `.titan/plans/prp-multi-branch-management.md`.
