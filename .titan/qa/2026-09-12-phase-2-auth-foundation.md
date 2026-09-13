# Phase 2 QA — Authentication foundation

Date: 2026-09-12
Result: partial phase passed

## Verified behavior

- The initial platform administrator exists in Supabase Auth.
- Its email is confirmed and its profile is linked to `private.platform_admins`.
- A password grant returned an authenticated session; the verification session was immediately signed out.
- No plaintext password was added to source code, migrations, plans, memory or QA files.
- A request to `/dashboard` without authentication returns `307` to `/login`.
- Public signup redirects to the managed-access notice.
- The deployed `onboard-organization` Edge Function accepts the authenticated platform administrator and rejects an invalid payload before mutation.
- Transactional SQL verification confirmed that onboarding creates the organization, branch, subscription, owner membership, requested modules and audit event atomically; the fixture transaction was rolled back.
- The platform dashboard lists real organizations with owner, branches, subscription and enabled modules.
- Owner team management lists memberships and can invite sellers by branch or external providers at organization level.
- Transactional invitation verification confirmed pending membership creation and automatic activation after email confirmation; fixtures were rolled back.
- Invitation callback regression fixed: `/auth/callback` accepts implicit fragment sessions, PKCE codes and token-hash links, clears credentials from the visible URL and routes invite/recovery flows through password creation.

## Application checks

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- HTTP verification: `/auth/callback` returns 200 and unauthenticated `/set-password` redirects to login.
- Browser automation was unavailable because Playwright is not installed; the live invitation link remains the final interactive verification.
- Active-member RLS verification passed against a real approved membership: assigned organization, enabled modules and operational guard were visible without cross-tenant or subscription-amount access.

## Supabase advisors

- No RLS, function-search-path, privilege or foreign-key-index findings were introduced.
- Leaked-password protection remains disabled at project level and must be enabled in Supabase Auth settings when available for the project plan.
- Unused-index information is expected while the new tables have no production traffic.

## Remaining Phase 2 work

- Implement owner-managed seller/provider invitations and membership lifecycle.
- Enforce expired/read-only and suspended access states in the application shell.
- Add owner controls to deactivate or reassign existing memberships.
- Add authenticated browser-flow coverage once a browser test runner is configured.
