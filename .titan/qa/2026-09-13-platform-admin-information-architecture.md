# Platform administration information architecture

Date: 2026-09-13

## Verified

- The platform dashboard derives aggregate organization, customer, order, member, production and subscription values from existing platform data.
- Organization management moved to the protected `/organizations` route.
- Platform navigation exposes Dashboard, Organizations and Base catalog separately.
- Organization search covers name, prefix and owner; status filtering is client-side over the authorized server result.
- Creation and detail/edit controls render only in named modal dialogs and close with Escape, the close button or the backdrop.
- Non-platform users are redirected away from `/organizations`.
- `npm run lint`, `npm run typecheck` and `npm run build` passed.
- Mobile routes now use a permission-aware hidden sidebar opened from a 44 px hamburger control. It closes on navigation, backdrop click, close button and Escape, and locks background scrolling while open.

## Pending interactive QA

- Confirm initial focus and focus return for both dialogs.
- Exercise onboarding, contract mutation and support-session mutation with the authenticated platform account.
- Inspect the directory at mobile, tablet and desktop widths with a larger fixture set.
- Recheck native select popup width in the organization dialog at 320 px and 390 px; CSS now constrains controls/options and removes horizontal dialog overflow, but no connected browser surface was available for visual confirmation.
