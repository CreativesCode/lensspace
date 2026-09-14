# Navigation, platform administration and catalog QA refinements

Date: 2026-09-14
Status: implemented locally and technically verified; final interactive browser QA remains
Source: visual QA feedback and implementation performed on 2026-09-13/14.

## Navigation and authorization-aware visibility

- The shared main navigation derives its active item from the current pathname;
  changing sections must also change the highlighted sidebar entry and expose
  `aria-current` on the active link.
- Navigation visibility follows the authenticated user's platform role, active
  memberships and enabled organization modules. Platform administrators see the
  dashboard, organizations and base catalog; tenant users see only operational
  destinations relevant to their role and enabled modules.
- Hiding links is a usability decision, not an authorization boundary. Server-side
  checks, database functions and RLS remain authoritative.
- Mobile uses the same allowed navigation in an off-canvas sidebar opened by a
  hamburger button. It closes after navigation, backdrop click, close action or
  Escape and prevents background scrolling while open.

## Platform administration information architecture

- `/dashboard` is a real data-backed dashboard for every user allowed to enter it.
  For the platform administrator it summarizes organizations, customers, orders,
  users, open production, trials and recent activity from the existing read model.
- Organization management moved to the dedicated platform-admin-only
  `/organizations` destination. Non-platform administrators are redirected away.
- The organization directory is designed for growth: it supports text search,
  status filtering, totals and per-organization actions instead of rendering every
  editable contract form permanently expanded.
- Creating an organization and viewing/editing an existing organization use dialogs.
  Existing audited contract, module and assistance mutations remain the write path.
- The detailed implementation plan is
  `.titan/plans/prp-platform-admin-information-architecture.md`; QA evidence is
  `.titan/qa/2026-09-13-platform-admin-information-architecture.md`.

## Catalog behavior and editing

- `/catalog` has two intentional modes. Platform administrators manage only global
  base items (`organization_id IS NULL`) and do not require a fabricated tenant
  membership. Owners and sellers retain the organization commercial catalog flow.
- Catalog cards label the sale price explicitly. Internal cost is visible only to
  management roles and not to sellers.
- Base-item and organization-override editing use dialogs with explicit field labels.
  The availability control matches the height and visual scale of adjacent fields.
- Text corruption was persisted data rather than a current source-encoding problem.
  Migration `supabase/migrations/20260913224717_repair_catalog_utf8_text.sql`
  repairs only the identified base catalog codes and `progressive_high_power` rule.
  Remote post-apply checks found zero remaining affected catalog items or rules.

## Select controls

- Native selects use consistent reserved arrow space and an SVG background chevron.
- All application selectors now use the shared `FormSelect` contained listbox; no
  native `<select>` remains under `src`. This gives filters, forms and dialogs the
  same mobile-safe menu, spacing and chevron.
- `FormSelect` preserves normal form submission through a hidden input, supports
  controlled and uncontrolled values, disabled state, form reset, click-outside and
  Escape closing. It uses a fixed 16 px SVG chevron that rotates when open. Do not
  replace it with a font glyph because glyph metrics caused the malformed arrow.
- ArrowUp, ArrowDown, Home and End update the selected option from the trigger.
  Interactive focus and screen-reader verification remains part of pilot QA.

## Verification and current limits

- `npm run lint`, `npm run typecheck` and `npm run build` passed after these changes;
  the production route manifest includes `/organizations`.
- The UTF-8 repair was applied and verified remotely with targeted queries.
- Final visual confirmation across real authenticated roles and mobile widths remains
  part of pilot QA. A connected browser surface was not available for the last check.
- These changes may still be uncommitted. This memory records implementation state,
  not a Git commit.

No credentials, connection strings or private user data are stored here.
