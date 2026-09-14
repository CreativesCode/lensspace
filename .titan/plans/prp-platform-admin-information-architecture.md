# PRP — Arquitectura de información de administración de plataforma

Status: completed
Date: 2026-09-13
Authorization: requested during visual QA of the superadministrator experience.

## Objective and value

Convert the platform entry point into a real dashboard backed by existing usage data, and move organization administration into a scalable dedicated workspace. Avoid rendering every organization and its full edit form in one long page.

## Scope and stack

- Preserve Next.js App Router, Supabase RLS and the Vision Studio design system.
- `/dashboard` presents platform-wide metrics, status distribution and recent tenant activity.
- `/organizations` presents searchable/filterable organization rows.
- Organization creation and organization detail/editing open in focused dialogs.
- The global base catalog remains at `/catalog`.
- No schema or authorization changes are required; existing platform RPCs and RLS remain authoritative.

## Expected behavior and acceptance

1. A platform administrator lands on a concise dashboard containing real aggregate values from existing organizations and `get_platform_usage`.
2. The sidebar exposes a separate `Organizaciones` destination only to platform administrators.
3. Organization search handles name, prefix and owner; status filtering remains usable with a large tenant count.
4. Creation is hidden until the administrator opens `Nueva organización`.
5. Detail, contract controls, module controls and audited assistance are hidden until the administrator opens the selected organization.
6. Dialogs have an accessible name, close control and Escape behavior.
7. Non-platform dashboards and navigation retain their current role-aware behavior.

## Evidence and architecture

- Current mixed view: `src/app/(main)/dashboard/page.tsx`.
- Current organization accordion: `src/features/admin/components/PlatformAdminWorkspace.tsx`.
- Current onboarding form: `src/features/admin/components/OrganizationOnboardingForm.tsx`.
- Existing read model: `get_platform_usage` consumed by `loadOrganizations`.
- Existing mutations: `update_platform_organization`, `begin_platform_support_session`, `end_platform_support_session`, and `onboard-organization`.
- Visual source of truth: `docs/design/` and the established Caribe moderno component language.

## Phases

1. Extract the platform organization loader for reuse by dashboard and organization workspace.
2. Build the real platform dashboard and update platform navigation.
3. Build the scalable organization list with search/status filters and dialogs.
4. Verify lint, TypeScript, production build and responsive structural behavior.

## Verification and rollout

- Run `npm run lint`, `npm run typecheck`, and `npm run build`.
- Verify platform/non-platform rendering contracts from server-side role branches.
- Interactive authenticated QA should confirm dialog focus, mutations and responsive layout with the available test account.

## Decisions and lessons

- 2026-09-13: organization management is a distinct destination, not the platform dashboard.
- 2026-09-13: reuse existing real usage data; do not introduce placeholder metrics or a new schema.
- 2026-09-13: use focused dialogs so page length does not grow with form complexity.

## Status

Completed 2026-09-13. Implemented the platform dashboard, `/organizations`, role-aware navigation, search/status filtering, creation dialog and organization detail/edit dialog. `npm run lint`, `npm run typecheck` and `npm run build` passed. Authenticated visual and keyboard QA remains part of pilot acceptance.
