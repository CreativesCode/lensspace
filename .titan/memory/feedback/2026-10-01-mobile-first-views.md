# Every view must work on mobile

Date: 2026-10-01

## Rule

The user requires every migrated or new view to work fully in the mobile
viewport (≈390 px), not only to look acceptable. This applies to all UI 2.0
phases and any later work.

- Design and verify each change for mobile and desktop together; never treat
  mobile as a follow-up.
- List/detail workspaces show one pane at a time on mobile with an explicit
  "volver" action; dialogs fit the viewport and scroll internally.
- Touch targets ≥ 44 px, inputs at 16 px on mobile (avoids iOS zoom), no
  horizontal page scroll, wrapping action rows.
- Every phase review checklist includes concrete mobile checks.

Source: explicit user instruction during the UI 2.0 migration.
