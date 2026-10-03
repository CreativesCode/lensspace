# Platform administration and pilot safeguards

Date: 2026-09-13

Updated 2026-10-02 (QA-38): support sessions now gate tenant reads. The platform
admin has no operational writes in any tenant; reading a tenant's operational data
requires an open, unexpired session of their own (`private.has_platform_support_session`).
`get_platform_usage` is SECURITY DEFINER so counters keep working. Still open:
starting a session silently closes the previous one without audit (QA-56).

Phase 7 platform controls are implemented locally and deployed to the linked
Supabase project. The superadministrator workspace now combines tenant status,
negotiated subscription fields, module entitlements, usage counters, audited
assistance and a link to the existing global base-catalog management.

Contract changes are atomic and require a reason of at least ten characters.
Module dependencies are revalidated in the database. Organization status is a
guarded column: authenticated users have the column privilege needed by the RPC,
but a trigger rejects changes unless `private.is_platform_admin()` succeeds.

Assisted access is represented by time-bounded support sessions with a recorded
reason, administrator, tenant, start, expiry and optional end. One administrator
may have only one unclosed session; starting another closes the previous one.
Durations are limited to 5–120 minutes. Start, end and contract changes write
organization audit events.

The usage read model reports customer, order, active-member, open-production-job
and notification-attempt counts plus last operational activity for each tenant.

The remote rollback fixture verified authorized mutations, usage, module changes,
three audit events and denial to a non-administrator. Interactive authenticated
pilot acceptance and responsive QA remain external because role credentials and
a browser surface were unavailable.

Evidence: `.titan/qa/2026-09-13-platform-admin-pilot.md`.

