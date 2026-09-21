# Production, provider access and linked rework

Date: 2026-09-13; updated 2026-09-21
Status: database deployed and remotely verified; application UI verified locally

Lens and mounting work are independent production jobs. An order has at most one
current job of each type. Assignment snapshots only the operational item names
and prescription data needed by the workshop; accepted prices, payment data and
customer identity are not exposed to providers.

An active provider membership with the matching role is required in the same
organization. Owners and the order's primary seller can assign work. Providers
read only jobs assigned to their account and perform only workshop-side
transitions. A cristalero may move an assigned lens job from pending to
fabrication and then mark it completed; a montador may move an assigned mounting
job from pending to mounting and then mark it completed. Optical-side preparation,
dispatch, receipt and review remain with the optical team. The UI calculates the
next action from the actor role so it never offers a transition that the database
will reject. Every transition appends an actor-attributed event.

Incidents preserve description and cost responsibility. Accepting a repetition
supersedes, but never overwrites, the incident job and creates one linked current
job from the immutable work snapshot.

## Provider UX corrections (2026-09-21)

- Cristaleros and montadores do not see sales creation, provider assignment or
  commercial empty states. They see only their assigned production jobs.
- Both provider roles can expand `Ver receta de fabricación` on a job. It shows
  OD/OI sphere, cylinder, axis, addition, pupillary distances, heights, prisms,
  prescription date and prescriber from the immutable assignment snapshot. It
  does not expose customer identity, accepted prices or payments.
- Reporting an incident uses an in-app dialog rather than browser prompts. The
  description is validated in Spanish and cost responsibility is selected from
  translated options. Its select opens upward inside the scrollable dialog.
- Optical assignment is launched from `Asignar trabajo` and completed in an
  in-app dialog instead of occupying permanent page space. Changing the order or
  job type clears any previously selected provider to prevent invalid assignment.
- Provider and optical transitions are role-aware in both UI and database. A
  provider sees `Iniciar fabricación` / `Iniciar montaje` and later `Marcar
  trabajo listo`; it is no longer offered an optical-only transition.
- The provider transition path was verified through the complete transactional
  SQL fixture against the linked database and rolled back successfully.
- Production status codes remain stable in English in PostgreSQL, but every
  user-facing label must be Spanish and identify the responsible party. Filters
  and cards use labels such as `En fabricación · Cristalero`, `En montaje ·
  Montador`, `Entregado al proveedor · Óptica` and `Recibido por la óptica`.
  The order timeline describes the actual event (`Asignado al cristalero`,
  `Cristales listos · Cristalero`, etc.) and translates `lens`/`mounting` to
  `Cristales`/`Montaje`; raw internal codes must never be shown to users.
- Current provider access still requires an invited Supabase account and normal
  authentication. A copyable, expiring passwordless provider link has been
  discussed but is not implemented; do not claim that such a link exists.

Evidence: `supabase/migrations/20260913165913_production_provider_workflows.sql`,
`supabase/migrations/20260921020911_align_provider_production_transitions.sql`,
`supabase/migrations/20260921103601_translate_production_statuses_to_spanish.sql`,
`supabase/tests/production_provider_workflows.sql` and
`.titan/qa/2026-09-13-production-provider-workflows.md`.

No credentials or private fixture data are stored here.
