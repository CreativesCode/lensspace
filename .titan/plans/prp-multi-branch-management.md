# PRP — Multi-branch management

Date: 2026-10-10
Status: implemented 2026-10-10 (browser QA pending a superadmin session)

## Problem

The `multi_branch` module exists and is sold (5 USD per extra branch), but no screen
creates a branch: only onboarding (`onboard_organization`) inserts the first one. The
data model is already branch-scoped (orders, quotations, customers, prescriptions,
payments, seller cashboxes, production jobs, memberships carry `branch_id`), and the
owner already filters commercial views by branch (memory 2026-09-20 owner branch
scope). What is missing is creating, editing and limiting branches.

## Goal

An owner with the `multi_branch` module creates and manages branches up to the number
in the signed license contract, assigns sellers to them and keeps working with the
existing branch filters. The platform admin can do the same for support.

## Behavior

1. `/team` (owner) gets a "Sucursales" section: list (name, code, active members,
   open orders), "Nueva sucursal" (name, code, address/phone optional), rename and
   deactivate/reactivate.
2. Limit: active branches ≤ 1 + `extra_branches` of the organization's signed license
   contract. Without a signed contract the limit is the module (1 + 0 → none extra) so
   trials can still test with an admin override. Over the limit the action explains
   "Tu plan incluye N sucursales; pide ampliarlo" (no silent failure).
3. Deactivating a branch is blocked while it has open orders, open production jobs or
   an open seller cashbox; members assigned to it must be reassigned first. Data stays
   readable (never deleted).
4. Sellers: the existing member management (`manage_organization_member`, target
   branch) lists every active branch; invitations ask for the branch.
5. Disabling the `multi_branch` module keeps extra branches readable but blocks new
   operations there (same rule as any module), and blocks creating branches.
6. Platform admin: branch count shown on the organization card (already) plus the
   contracted limit; can create a branch for support (audited).

## Data / server

- RPCs `create_branch`, `update_branch`, `set_branch_active` (security invoker,
  owner of the organization or platform admin, audited); replace the direct
  `branches_insert_owner_or_platform_admin` policy with the RPC path.
- `private.branch_limit(organization_id)` = 1 + signed contract `extra_branches`
  (0 when none); enforced in `create_branch` and on reactivation.
- Unique `(organization_id, code)` already expected; verify before the migration.
- Check every branch-scoped write path still validates `branch.is_active`.

## Phases

1. Inventory: list all writes that take `branch_id` and confirm each checks the branch
   is active and belongs to the organization → verify with a SQL test.
2. Migration (limit helper, RPCs, policy change, audit) + SQL test (limit, inactive
   branch rejected, cross-tenant rejected).
3. `/team` Sucursales UI (mobile first) + branch picker in invitations.
4. Admin panel: limit next to the branch count; support create.
5. Playwright: owner creates 2nd branch, assigns seller, sells, filters by branch,
   limit message at N+1; evidence in `.titan/qa/`.

## Open questions for the product owner

- Can a seller work in more than one branch, or exactly one (today: one `branch_id`
  per membership)?
- Shared or separate customer base between branches? Today customers carry
  `branch_id`; BUSINESS_LOGIC says commercial config is shared per organization.
- Should each branch have its own order prefix, or keep one sequence per
  organization?

## Decisions (product owner, 2026-10-10)

- A seller works in exactly one branch (unchanged).
- Customers and prescriptions stay per branch (unchanged).
- One order sequence per organization (unchanged).
- **Only the platform admin creates and changes branches** (no owner self-service):
  the owner UI items in "Behavior" 1 and 6 collapse into the admin panel.

## Implementation notes

- `20261011030648_multi_branch_management.sql`: `branches.is_primary` (backfilled,
  one per organization), `private.is_operational_branch` added to
  `can_write_branch_clinical_data` and `can_write_seller_sale` (active branch, and
  primary or multi_branch enabled), `private.branch_limit` = 1 + signed contract
  `extra_branches`, admin RPCs `create_branch`, `update_branch`, `set_branch_active`,
  `set_primary_branch` (audited); direct insert/update on `branches` revoked.
- `20261011030815_first_branch_is_primary.sql`: trigger marks the first branch of an
  organization as primary. Found during implementation: onboarding inserts the branch
  without the flag, so a new organization would have been read-only.
- Deactivation is blocked by: primary branch, orders with `commercial_status =
  'accepted'`, payments not allocated to a cashbox closure, active/invited members.
- UI: `BranchManagementPanel.tsx` in the organization dialog of /organizations.
- Known gap: owner filters list only active branches, so data of a deactivated branch
  is kept but not filterable from the owner views.
- Test: `supabase/tests/multi_branch_management.sql` (ran rolled back before applying).
