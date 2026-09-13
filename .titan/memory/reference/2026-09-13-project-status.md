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
3. Build customer search/create UI with duplicate-candidate warnings and atomic
   writes.
4. Build prescription entry and revision UI plus private Storage bucket policies.
5. Continue Phase 3 with catalog, pricing and graduation-rule fixtures.
6. Complete interactive responsive/mobile QA for the refreshed views.

## Evidence

- `.titan/qa/2026-09-13-owner-member-management.md`
- `.titan/qa/2026-09-13-clinical-foundation.md`
- `.titan/qa/design-refresh/2026-09-13-design-refresh.md`

No credentials, connection strings or private user data are stored here.
