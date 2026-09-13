# Production, provider access and linked rework

Date: 2026-09-13
Status: database deployed and remotely verified; application UI verified locally

Lens and mounting work are independent production jobs. An order has at most one
current job of each type. Assignment snapshots only the operational item names
and prescription data needed by the workshop; accepted prices, payment data and
customer identity are not exposed to providers.

An active provider membership with the matching role is required in the same
organization. Owners and the order's primary seller can assign work. Providers
read only jobs assigned to their account and perform only workshop-side
transitions. Optical-side dispatch, receipt and review remain with the optical
team. Every transition appends an actor-attributed event.

Incidents preserve description and cost responsibility. Accepting a repetition
supersedes, but never overwrites, the incident job and creates one linked current
job from the immutable work snapshot.

Evidence: `supabase/migrations/20260913165913_production_provider_workflows.sql`,
`supabase/tests/production_provider_workflows.sql` and
`.titan/qa/2026-09-13-production-provider-workflows.md`.

No credentials or private fixture data are stored here.
