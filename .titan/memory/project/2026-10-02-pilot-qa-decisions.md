# Pilot QA decisions and readiness

Date: 2026-10-02

Plan: `.titan/plans/prp-pilot-qa-hardening.md` (61 items; evidence in
`.titan/qa/2026-10-02-pilot-qa/`). Verdict: not pilot-ready until Phase 1
(QA-01..QA-11) plus QA-28/QA-30 ship. WhatsApp delivery works, but OpenWA
answers HTTP 500 after sending, so attempts are stored as failed (QA-61).

## Product owner decisions

- "Pedido listo" WhatsApp is manual only (explicit action, re-sendable after
  rework); the automatic `order_ready` trigger goes away (QA-08).
- Delivering before production is reviewed shows a non-blocking warning (QA-14).
- USD full-balance payments round up to the cent; the server tolerates that
  sub-cent overshoot and caps the CUP equivalent; any remainder can be paid in CUP (QA-18).
- The pilot starts on a clean organization; QA duplicate payments in Óptica Javier
  stay as test history (QA-03).
- Suspended subscription = all operations blocked, data read-only (current
  behavior kept; BUSINESS_LOGIC.md aligned) (QA-37).
- Cache strategy approved: never cache tenant RSC data, balances, payments,
  cashbox or order status; cache static assets, sale drafts and an optional
  provider jobs snapshot locally.
- Business USD→CUP rate comes from elTOQUE on demand: a button fetches it (one
  elTOQUE call per Havana day for the whole platform, cached in
  `market_exchange_rates`) and the organization keeps it until the next tap.
  Scraping eltoque.com is not viable (Cloudflare challenge); the official API needs
  the `ELTOQUE_API_TOKEN` Edge Function secret. Default order: business rate →
  last order rate → 420; a sale can still override it.
  **Status 2026-10-02: waiting for the elTOQUE token** (requested by the product
  owner; approval may take up to a week). Then set the `ELTOQUE_API_TOKEN` secret.
- OpenWA false negative (QA-61): our side done; the VPS fix (Vault session UUID,
  OpenWA logs) stays pending with the product owner.
- WhatsApp messages carry the shop name, the sender's name and phone (QA-08 follow-up).
- Superadmin (QA-38): never operational writes in a tenant; reading a tenant's
  operational data requires an open, audited support session for that organization
  (`private.has_platform_support_session`). Base catalog and platform admin unchanged.
- Invitations (QA-39): always `invited`; new accounts activate by confirming the
  email, existing accounts accept/decline on the dashboard. Owners cannot activate
  an invited member; the invite response never reveals whether an account exists.
- Phase 6 requests (not started): profile page with password change (QA-62),
  landing recognizes a signed-in user (QA-63), manual editable only by the
  superadmin and read-only + PDF for everyone else (QA-64).

## Test accounts and data

- QA orgs: "QA Piloto Solo 2026-10-02" (QAS), "QA Piloto Admin 2026-10-02" (QAP),
  "QA Piloto Admin B" (QAB); owners `qa.*.20261002@lensspace.test` (passwords in the plan).
- Customers named "QA PILOTO ..." with consent OFF, except "QA PILOTO WhatsApp"
  (consent ON, product owner's controlled number) on JAV-2026-000018, kept open
  for the OpenWA re-test.
