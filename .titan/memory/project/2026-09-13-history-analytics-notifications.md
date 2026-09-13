# Order history, analytics and manual notifications

Date: 2026-09-13

Phase 6 is implemented locally and its migration is applied to the linked
Supabase project.

Orders expose one chronological read model composed from acceptance,
confirmations, payments, production events, incidents, manual notification
attempts and delivery. Actor identifiers and display names are preserved where
an actor exists.

The owner dashboard computes filtered sales, collections, balances, order and
incident counts, delivery time, cash differences, seller totals, provider loads
and top items. Filters cover branch, seller and an inclusive date range of at
most 367 days.

WhatsApp remains a manual boundary. Active templates render customer, order and
balance snapshots. Each preparation writes an immutable attempt with provider
key `manual`, outcome and any failure code before the browser opens WhatsApp.
The TypeScript adapter owns URL construction so a future OpenWA transport does
not alter the database contract. Missing consent and missing recipients are
recorded as failures without opening a transport.

Authenticated role-based responsive browser QA remains pending because no
browser surface or test credentials were available in the implementation
session. The remote transactional fixture passed and rolled back.

Evidence: `.titan/qa/2026-09-13-phase6-history-analytics-notifications.md`.

