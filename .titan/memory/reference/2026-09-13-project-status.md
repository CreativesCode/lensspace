# Current implementation status

Date: 2026-09-13

## Product and platform foundation

- The implementation plan is `.titan/plans/prp-vision-studio-mvp.md`.
- Next.js and Supabase provide authentication, session refresh, protected routes,
  multi-tenant organizations and branches, subscriptions, module entitlements,
  invitations and role-aware dashboards.
- The platform administrator can provision an organization, first branch,
  subscription, modules and confirmed owner atomically, then review organization
  summaries.
- Owners can invite sellers and external providers, reuse eligible provider
  accounts, deactivate/reactivate managed members and reassign active sellers.
  Membership mutations use an audited RPC; authenticated clients cannot update
  memberships directly.
- Expired or suspended organizations remain visible but read-only in implemented
  mutation paths.

## Clinical foundation

- Applied migrations define branch-owned customers, multiple non-unique normalized
  phone records, stable prescriptions, append-only clinical revisions and
  prescription-file metadata.
- Branch-scoped RLS admits owners and same-branch sellers while excluding unrelated
  tenants and external providers.
- Covering indexes were added for the clinical foreign keys flagged by advisors.
- Remote transactional fixtures verified tenant isolation, duplicate-phone
  retention and immutable revisions, then rolled back.
- Customer search/create is available at `/customers`. It supports name and
  normalized-phone lookup, existing-customer reuse, duplicate review and atomic
  creation of a customer with up to five phones. Transactional remote fixtures
  verified shared-phone retention and rollback on a failed phone insert.
- Prescription entry and immutable corrections are available at `/prescriptions`.
  The private `prescription-originals` bucket accepts JPEG, PNG, WebP and PDF up
  to 10 MB; object paths are authorized against organization, branch,
  prescription and revision. Failed metadata writes can remove only their own
  still-unregistered object.

## Commercial catalog foundation

- Catalog and price simulation are available at `/catalog` for owners and
  sellers with operational `optical_sales` access. Owners can create tenant
  items and override base-item availability, cost, sale price and currency;
  sellers have calculation-only access.
- The catalog uses a global base plus organization-specific items and overrides.
  Exact numeric amounts and each line's original currency are preserved. An
  explicitly supplied USD-to-CUP rate produces only a summary equivalent.
- The database pricing function resolves effective prices, validates access and
  returns deterministic line items, totals, clinical metrics and non-blocking
  compatibility/graduation warnings. Graduation rules may add a disclosed
  surcharge but never silently block a sale.
- Remote transactional fixtures verified a high-graduation surcharge, mixed CUP
  and USD totals, tenant overrides, seller calculation access and denial of
  seller price changes. All fixture data was rolled back.

## Quotation and order foundation

- `/sales` supports selecting a customer, optional prescription, catalog
  configuration, an explicit exchange rate, quotation review and verbal customer
  acceptance.
- Saving a quotation snapshots the current proposal. Acceptance recalculates it;
  a catalog price change rejects the transition and requires reconfirmation.
- Successful acceptance atomically creates the numbered order, immutable line and
  currency snapshots, exchange-rate snapshot and confirmation record.
- RLS preserves seller-owned commercial isolation while owners retain organization
  access. Remote rollback fixtures verified acceptance, numbering, immutability
  and price-change rejection.

## Payments and delivery

- `/orders` lists the commercial records visible to the current seller/owner and
  exposes payment detail, remaining balance and guarded delivery.
- Cash payments support CUP and USD, preserve amount/currency/applied rate and
  generate an immutable CUP equivalent. Payment status updates automatically and
  overpayments are rejected.
- Every sale now requires an exchange-rate snapshot. The order balance uses its
  accepted CUP equivalent, independent of later catalog or global rate changes.
- A database transition guard prohibits delivery with any pending balance and has
  no application-level override. Remote rollback fixtures verified the unpaid
  rejection, partial/final mixed-currency payments and successful paid delivery.

## Mandatory design rule

- `docs/design/` is the visual source of truth for every existing and future view.
- Use a concrete composition from `Vision Studio.dc.html` when available. For
  undesigned screens, assemble the patterns in `Componentes Vision Studio.dc.html`;
  identity always follows `Identidad Vision Studio.dc.html`.
- Reuse the extracted Vision Studio logo and shared components. Do not introduce a
  parallel generic design language.
- Existing authentication and dashboard views now inherit the Caribe moderno
  palette, Space Grotesk/Source Sans 3 typography, radii, shadows and responsive
  shell. Password fields in login, password activation and owner onboarding use
  the shared accessible reveal/conceal control.

## Verification and known warnings

- Lint, TypeScript checking and the Next.js production build passed after the
  current implementation and design refresh.
- Desktop login returned HTTP 200 and was visually inspected. Interactive mobile
  QA remains pending because the automated browser capture did not initialize
  reliably; no failed mobile image was retained as evidence.
- Supabase advisors retain two known items: the intentionally authenticated
  `SECURITY DEFINER` member-management RPC and project-level leaked-password
  protection, which still needs enabling in the Auth dashboard.
- A development server was started only for QA and then stopped. Future sessions
  must detect or start the server instead of assuming a port or running process.
- Current repository changes are local and may be uncommitted; memory does not
  claim a Git commit.

## Next work

1. Apply the design precedence and shared component library to every new view.
2. Carry the operational/read-only guard into each future write feature.
3. Finish Phase 4 with seller cashboxes and immutable primary/complementary daily
   closures, including post-close payment attribution. Detailed scope and
   acceptance criteria: `.titan/memory/reference/2026-09-13-next-work.md`.
4. Complete interactive responsive/mobile QA for the refreshed views, including
   the customer, prescription, catalog, sales and order/payment workspaces.

## Evidence

- `.titan/qa/2026-09-13-owner-member-management.md`
- `.titan/qa/2026-09-13-clinical-foundation.md`
- `.titan/qa/2026-09-13-prescription-workflow.md`
- `.titan/qa/2026-09-13-catalog-pricing.md`
- `.titan/qa/2026-09-13-quotation-order-snapshots.md`
- `.titan/qa/2026-09-13-payments-balances-delivery.md`
- `.titan/qa/design-refresh/2026-09-13-design-refresh.md`

No credentials, connection strings or private user data are stored here.
