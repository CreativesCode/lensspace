# Owner member-management verification

Date: 2026-09-13

## Outcome

- Owners can deactivate and reactivate sellers and external providers.
- Owners can reassign active sellers to another active branch in the same organization.
- Owner memberships are not editable through this workflow.
- Expired or suspended organizations remain read-only.
- Every accepted change appends a `membership.updated` audit event.
- Authenticated clients cannot update `organization_memberships` directly.

## Verified evidence

- Migration `20260913033108_manage_organization_members.sql` applied to the connected Supabase project.
- A rolled-back remote SQL fixture proved an owner-authorized update and its audit event.
- The same transaction proved an unrelated authenticated actor receives `insufficient_privilege`.
- Privilege inspection returned direct membership update `false` and RPC execution `true` for `authenticated`.
- Supabase security advisor reports the expected warning for the intentionally authenticated `SECURITY DEFINER` RPC and the pre-existing leaked-password setting warning.
- Lint, TypeScript checking and the Next.js production build pass.

## Remaining external setting

Enable Supabase Auth leaked-password protection in the project dashboard.
