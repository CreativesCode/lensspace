# PRP — Vision Studio MVP

Status: in progress
Date: 2026-09-12
Authorization: the user requested implementation after confirming that only the business plan existed.

## Objective and value

Build the first production-capable version of Vision Studio, a multi-tenant SaaS for optical stores in Cuba. The system must carry an optical order from prescription and quotation through cash collection, production, mounting, notification and delivery while preserving tenant isolation and an immutable operational history.

The immediate objective is to establish the security and tenancy foundation on which every later feature depends. No operational UI or table may precede verified organization, membership, subscription, entitlement and RLS contracts.

## Scope and stack

- Next.js App Router, React, TypeScript and Tailwind CSS in the existing application.
- Supabase Auth, Postgres, RLS and private Storage for application data.
- Vercel is the intended application host.
- Email/password authentication; onboarding is managed by the platform superadministrator.
- Mandatory Core plus configurable Optical Sales, Cashbox, Production, WhatsApp, Analytics and Multi-branch modules.
- CUP and USD initially, with per-item currencies and sale-specific exchange-rate snapshots.
- OpenWA remains behind a provider interface and is not integrated until connection details are supplied.

Excluded from the MVP: complete frame inventory, warranties/after-sales, refunds, formal cancellations, fiscal documents, customer accounts/signatures and non-cash payment methods.

## Expected behavior and acceptance

1. Every operational row is owned by one organization; branch-owned rows also carry a branch belonging to that organization.
2. Authenticated users see only organizations to which they have an active membership, except the audited platform-superadmin path.
3. Sellers see only their own orders, payments and cashbox data, while branch colleagues may reuse basic customer and prescription data without commercial visibility.
4. External providers use one account across organizations and see only jobs explicitly assigned to them.
5. Expired organizations are read-only and suspended organizations are blocked; module entitlements are enforced server-side as well as reflected in the UI.
6. Accepted prices, currencies and exchange rates remain historical snapshots.
7. Delivery cannot complete while a balance remains; provider-dispatched work is corrected through linked incidents/rework rather than overwritten.
8. Sensitive transitions identify the real actor and append audit/history events that ordinary application users cannot edit or delete.
9. Representative RLS tests prove same-tenant allowed cases and cross-tenant denied cases for every table introduced.

## Evidence and architecture

- Product requirements: `BUSINESS_LOGIC.md`.
- Durable decisions: `.titan/memory/project/2026-09-12-vision-studio-scope.md` and `2026-09-12-application-stack.md`.
- Current code is a scaffold: `src/app/(auth)/*`, `src/app/(main)/dashboard/page.tsx`, and `src/lib/supabase/*`.
- The connected Supabase project was inspected on 2026-09-12 and had no public tables or migration history.
- Database changes use local files in `supabase/migrations/`, lowercase identifiers, timezone-aware timestamps, exact numeric money values, indexed foreign keys and RLS on every public table.
- Authorization is database-backed. User-editable JWT metadata is never used for authorization. Internal security-definer helpers live in a non-exposed schema with fixed empty search paths and explicit execution grants.
- The application uses feature-first modules under `src/features/`; shared infrastructure remains under `src/lib` and `src/shared`.

## Data model direction

Phase-specific details are finalized only when entering that phase. The stable aggregate boundaries are:

- Core: profiles, platform administrators, organizations, branches, memberships, subscriptions, module catalog/entitlements and audit events.
- Sales: customers/phones, prescriptions and revisions/files, catalog items/rules, quotations and confirmations, orders and immutable price snapshots.
- Cashbox: payments, seller cashboxes, primary/complementary closings and differences.
- Production: provider relationships, lens/mounting jobs, assignments, state events, incidents and linked rework.
- Communications: templates and immutable message attempts behind a provider interface.
- Analytics: security-invoker read models or server-side queries derived from operational records.

Physical deletion is unavailable to normal product flows. Business entities use active/archive/void state where appropriate, while immutable history and financial records remain append-only.

## Phases

### Phase 1 — Core tenancy, access and entitlements (completed 2026-09-12)

Outcome: versioned Supabase schema for profiles, organizations, branches, memberships, subscriptions, modules and audit, including minimal privileges and RLS helpers/policies.

Verification:

- Migration applies cleanly to the connected empty project.
- All public tables have RLS enabled.
- Foreign keys used for membership/RLS lookups are indexed.
- Security and performance advisors have no unresolved errors caused by the migration.
- SQL tests demonstrate tenant isolation and subscription/module operation checks.
- Generated TypeScript database types are committed and application checks pass.

### Phase 2 — Managed authentication and onboarding (completed 2026-09-13)

Outcome: email/password login, session refresh middleware, protected layouts, platform-superadmin organization/first-owner onboarding and owner-managed seller/provider invitations.

Verification: login/logout/session refresh, route protection, inactive/suspended/expired behavior, invitation acceptance and role-specific navigation.

### Phase 3 — Customers, prescriptions and catalog/pricing

Outcome: branch-shared customer/prescription lookup, revision audit, private files, configurable multi-currency catalog and advisory graduation rules.

Verification: duplicate warnings, prescription revision preservation, private-file policies, deterministic price fixtures and cross-seller commercial isolation.

Completed 2026-09-13: customer, non-unique phone, prescription, immutable revision
and private-file metadata tables are deployed with tenant/branch RLS. Customer
search/create supports duplicate review, existing-customer reuse and atomic
customer/phone writes. Prescription entry, immutable corrections and private
original-file Storage are implemented. The catalog combines global base items,
tenant items and tenant overrides; its database pricing engine preserves original
currencies, calculates an explicit CUP equivalent and emits advisory graduation
and compatibility warnings. Owner management and seller calculation paths are
available at `/catalog`. Interactive responsive QA remains part of pilot hardening.

### Phase 4 — Quotations, orders, payments and cashbox

Outcome: quotation acceptance into orders, immutable price/exchange snapshots, mixed-currency cash payments, balances and primary/complementary seller closings.

Verification: totals and conversions, reconfirmation after price changes, zero-balance delivery guard, post-close payment behavior and immutable closing tests.

### Phase 5 — Production, providers and incidents

Outcome: one active lens provider and mounting provider per order, assignments, independent state dimensions, provider-scoped access, incidents and linked rework.

Verification: transition guards, assignment isolation across organizations, post-dispatch edit lock and cost-responsibility history.

### Phase 6 — History, dashboards and WhatsApp boundary

Outcome: complete order timeline, owner dashboards and manual template-driven notification attempts through a replaceable provider interface.

Verification: metric fixtures, actor attribution, branch/seller filters, message attempt history and provider failure states.

### Phase 7 — Platform administration and pilot hardening

Outcome: tenant/subscription/module administration, audited assisted access, operational safeguards and full pilot flow.

Verification: full role matrix, tenant-isolation suite, accessibility/responsive QA, production build, migration recovery rehearsal and Cuba pilot acceptance script.

## Dependencies and rollout

- Phases are dependent and implemented in order; UI cannot compensate for missing database authorization.
- Structural changes are versioned locally before remote application.
- The current remote database is empty, so Phase 1 has no data migration burden. Later destructive changes require explicit recovery/backfill plans.
- OpenWA, production Vercel configuration and pilot data remain external dependencies and are deferred until their phases.

## Verification record

- 2026-09-12: repository, business rules, dependency versions and connected Supabase schema inspected.
- 2026-09-12: remote public schema and migration list confirmed empty; initial security/performance advisor lists were empty.
- 2026-09-12: Phase 1 migrations applied to the connected project. Transactional tenant, subscription and module-dependency checks passed and rolled back their fixtures.
- 2026-09-12: security advisor returned no findings. The only remaining performance notices are expected unused-index notices on the new empty tables.
- 2026-09-12: generated database types were added to both Supabase client helpers; lint, typecheck and production build passed.
- 2026-09-12: managed email/password login, session-refresh proxy, signed-out dashboard redirect and sign-out were implemented. The initial confirmed platform administrator was provisioned outside migrations and its credentials were not persisted in the repository.
- 2026-09-12: platform-admin onboarding UI and authenticated Edge Function implemented. Atomic database onboarding creates the organization, first branch, subscription, owner membership, module entitlements and audit event.
- 2026-09-12: platform organization listing and owner team management implemented. Invitations support sellers by branch and external lens/mounting providers, including reuse of an existing account across organizations and automatic membership activation after email confirmation.
- 2026-09-12: seller/provider dashboard implemented with organization, branch, role, module and operational-state visibility. Expired/suspended tenants cannot mutate team membership.
- 2026-09-13: owner controls for member deactivation/reactivation and seller branch reassignment implemented through an authenticated, audited database function. Direct membership updates were revoked from authenticated clients; authorized and denied paths passed transactional remote checks.
- 2026-09-13: Phase 3 clinical foundation deployed. Transactional fixtures proved same-branch seller access, cross-branch and unrelated-user isolation, non-unique normalized phone matching, and append-only prescription revisions.
- 2026-09-13: prescription entry and immutable correction UI deployed with private
  original-file Storage. Transactional fixtures verified sequential revisions,
  required correction reasons and tenant/branch/path authorization.
- 2026-09-13: Phase 3 catalog/pricing deployed. Transactional fixtures verified
  effective organization overrides, mixed-currency totals, an explicit CUP
  equivalent, high-graduation surcharge warnings, seller calculation access and
  seller denial on price mutation; all fixtures were rolled back. TypeScript,
  ESLint and the Next.js production build passed with `/catalog` included.

## Decisions and open questions

- 2026-09-12: use database tables—not user metadata—as the authorization source.
- 2026-09-12: keep platform administrators separate from organization memberships.
- 2026-09-12: organization owners may read subscription/module configuration, while only platform administrators change negotiated entitlements.
- Open question for a later phase: exact OpenWA API contract and operational failure/retry policy.
- Open question for pilot preparation: organization-specific timezone defaults and initial commercial catalog contents.
- Project setting pending: enable Supabase Auth leaked-password protection when the plan/dashboard exposes it.
