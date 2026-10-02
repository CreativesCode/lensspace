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

## Test accounts and data

- QA orgs: "QA Piloto Solo 2026-10-02" (QAS), "QA Piloto Admin 2026-10-02" (QAP),
  "QA Piloto Admin B" (QAB); owners `qa.*.20261002@lensspace.test` (passwords in the plan).
- Customers named "QA PILOTO ..." with consent OFF, except "QA PILOTO WhatsApp"
  (consent ON, product owner's controlled number) on JAV-2026-000018, kept open
  for the OpenWA re-test.
