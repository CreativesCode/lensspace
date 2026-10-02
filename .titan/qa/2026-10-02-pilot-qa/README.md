# Pilot QA evidence — 2026-10-02

Date: 2026-10-02
Plan: [`.titan/plans/prp-pilot-qa-hardening.md`](../../plans/prp-pilot-qa-hardening.md). Its findings table maps QA-xx IDs to the source IDs used below.
Method: Playwright against the dev server on `:3000`, plus a production build on a scratch copy at `:3100` (since stopped). CDP emulation covered throttling (600 ms latency, 40/20 KB/s), offline windows and lost responses. Viewports were desktop and 390x844. Live DB checks ran through the Supabase MCP.
Verdict: **not ready as-is**. The pilot can go ahead after Phase 1 plus QA-28 and QA-30.

No credentials are stored in this folder. The QA `.test` account passwords are listed only in the plan.

## Flows tested

| Area | Flow | Result | Notes / plan IDs |
|------|------|--------|------------------|
| Solo owner | Superadmin onboarding of a solo org | partial | Success toast lost, invalid pattern regex (QA-51), prefix typed by hand (QA-50) |
| Solo owner | Owner first run | partial | Empty states are clear; no prefix setting |
| Solo owner | Catalog: base, tenant item, override | fail | Overrides return 403 (QA-06) |
| Solo owner | Full sale with new customer, prescription and file | partial | Totals correct; original upload always fails (QA-05) |
| Solo owner | Shortest sale (existing customer) | pass | 6 clicks, 0 fields, ~4.8 s |
| Solo owner | Production without providers | **fail** | Cannot assign or finish (QA-01) |
| Solo owner | Notification with consent OFF | partial | Logged as missing_consent; reason hidden and stored as mojibake (QA-43, QA-48) |
| Solo owner | Delivery with balance, then pay and deliver | partial | Attributed to 'Sistema' (QA-10); not tied to production (QA-14) |
| Solo owner | Cashbox closure | **fail** | Owner cannot close (QA-02) |
| Solo owner | Dashboard and nav counters | partial | Counters stale (QA-24) and include superseded jobs (QA-25) |
| Solo owner | Sale at 390x844 | pass | 14.1 s; no sticky action bar (QA-16) |
| Solo owner | Poor connectivity | **fail** | Duplicate payment (QA-03), stuck accept (QA-04), offline navigation lost (QA-28) |
| Multi-role | Javier full sale | pass | 9 clicks, 11 fields |
| Multi-role | Assign lens job to Claudia | partial | Order chosen by number only (QA-13); no live refresh (QA-27) |
| Multi-role | Claudia data isolation | pass | No customer, price or payment data visible |
| Multi-role | Claudia transitions | partial | Sees 'Aceptar repetición' (QA-42) |
| Multi-role | Cross-user refresh | **fail** | No update after 30 s (QA-27, QA-24) |
| Multi-role | Owner acting on behalf of provider | **fail** | QA-01 |
| Multi-role | Incident and rework | partial | Rework cannot be reassigned (QA-41) |
| Multi-role | Mounting without a mounter | **fail** | QA-01 |
| Multi-role | Receive, deliver | partial | Premature 'Pedido listo' (QA-08) |
| Multi-role | Payment on a poor link | **fail** | Duplicate payment (QA-03) |
| Multi-role | Claudia on mobile | partial | QA-45 |
| Multi-role | Isolation probes as Claudia | pass | Commercial pages still render empty states (QA-46) |
| Sales friction | Full sale on desktop | pass | 11 clicks, 10 fields |
| Sales friction | Full sale on mobile | partial | QA-16 |
| Sales friction | Burst clicks | **fail** | Duplicate customers, quotations and payments (QA-03) |
| Sales friction | Offline submit | partial | Raw errors (QA-30) |
| Sales friction | Lost response | **fail** | QA-03, QA-04 |
| Sales friction | Reload or back mid-sale | **fail** | Draft lost (QA-17) |
| Sales friction | Homonym / duplicate phone | fail / partial | QA-19, QA-20 |
| Sales friction | Customer search | pass | Unbounded order list per search (QA-32) |
| Sales friction | Prescription validation | partial | QA-44, UTC date (QA-11) |
| Sales friction | Price adjustment | pass | |
| Sales friction | Rate edge cases | partial | QA-22 |
| Sales friction | Overpayment, USD payments | partial | USD residue (QA-18) |
| Sales friction | Slow network | partial | No pending labels (QA-21) |
| Admin/platform | Superadmin dashboard | pass | Waterfall (QA-31) |
| Admin/platform | Create org | partial | QA-51 |
| Admin/platform | Edit contract | pass | QA-55 |
| Admin/platform | Module dependencies | partial | QA-57 |
| Admin/platform | Audit trail UI | fail | QA-54 |
| Admin/platform | Support session | partial | QA-56, QA-38 |
| Admin/platform | Expired subscription | partial | QA-40 |
| Admin/platform | Suspended | fail | QA-37 |
| Admin/platform | Renewal | partial | QA-27 |
| Admin/platform | Module disabled | partial | QA-27 |
| Admin/platform | Superadmin non-operational | fail | QA-38 |
| Admin/platform | Base catalog | partial | QA-53 |
| Admin/platform | Cross-tenant isolation | pass | |
| Admin/platform | Storage upload | fail | QA-05 |
| Admin/platform | Team invite | partial | QA-39 |
| Admin/platform | Team deactivate | partial | QA-58 |
| Admin/platform | Auth | partial | QA-23, QA-59 |
| Admin/platform | Offline admin forms | partial | QA-30 |
| Admin/platform | Mobile | pass | |
| Admin/platform | Advisors | pass | QA-60 |
| Performance | Production build, cold/warm loads | pass / partial | ~300 KB cold, 9–17 KB warm; TTFB 0.65–2.6 s (QA-31) |
| Performance | Sidebar navigation | partial | No feedback (QA-29); prefetch volume (QA-33) |
| Performance | Offline | **fail** | QA-28 |
| Performance | Draft survives leaving /sales | fail | QA-17 |
| Performance | Counters on soft navigation | fail | QA-24 |
| Performance | Mobile, throttled | pass | |
| Performance | Customer search, throttled | partial | QA-32 |
| Refresh/cache | Mutation inventory | partial | Only team, admin and auth call `router.refresh()` |
| Refresh/cache | Sale | pass | |
| Refresh/cache | Counters | fail | QA-24 |
| Refresh/cache | Back/forward | fail | QA-26 |
| Refresh/cache | Two tabs | partial | QA-27 |
| Refresh/cache | Concurrent overpay and deliver | pass | Locks hold; raw copy (QA-30) |
| Refresh/cache | Triple submit | fail | QA-03 |
| Refresh/cache | Lost response | fail | QA-03, QA-04 |
| Refresh/cache | Refetch failure | fail | QA-09 |
| Refresh/cache | Offline form | partial | QA-30 |
| Refresh/cache | Offline navigation | fail | QA-28 |
| Refresh/cache | Hung request | fail | QA-21 |
| Refresh/cache | Reload mid-sale | fail | QA-17 |
| Refresh/cache | Timezone | partial | QA-11 |
| Refresh/cache | Client storage | pass | |

## Screenshots and artifacts

### `solo-owner/` (org QA Piloto Solo, owner `qa.solo.20261002@lensspace.test`)
- [01-admin-onboarding-form](solo-owner/01-admin-onboarding-form.png), [02-admin-after-create](solo-owner/02-admin-after-create.png) — QA-51
- First run: [dashboard](solo-owner/03-firstrun-dashboard.png), [sales](solo-owner/03-firstrun-sales.png), [orders](solo-owner/03-firstrun-orders.png), [customers](solo-owner/03-firstrun-customers.png), [prescriptions](solo-owner/03-firstrun-prescriptions.png), [production](solo-owner/03-firstrun-production.png), [cashbox](solo-owner/03-firstrun-cashbox.png), [catalog](solo-owner/03-firstrun-catalog.png), [team](solo-owner/03-firstrun-team.png)
- [04-catalog-override-error](solo-owner/04-catalog-override-error.png) — QA-06; [04-catalog-simulation](solo-owner/04-catalog-simulation.png)
- [06-sale-quote](solo-owner/06-sale-quote.png), [07-sale-after-payments](solo-owner/07-sale-after-payments.png), [08-short-sale-accepted](solo-owner/08-short-sale-accepted.png)
- [09-production-assign-no-provider](solo-owner/09-production-assign-no-provider.png), [09b-team-invite-dialog](solo-owner/09b-team-invite-dialog.png), [10-team-self-provider](solo-owner/10-team-self-provider.png), [11-production-stuck-self-provider](solo-owner/11-production-stuck-self-provider.png) — QA-01
- [12-production-incident-rework](solo-owner/12-production-incident-rework.png) — QA-25
- [13-orders-deliver-blocked](solo-owner/13-orders-deliver-blocked.png), [14-orders-delivered-timeline](solo-owner/14-orders-delivered-timeline.png) — QA-10
- [15-cashbox-closed](solo-owner/15-cashbox-closed.png), [15b-cashbox-closed-after-self-seller](solo-owner/15b-cashbox-closed-after-self-seller.png), [16-cashbox-complementary](solo-owner/16-cashbox-complementary.png) — QA-02
- [17-offline-create-customer](solo-owner/17-offline-create-customer.png), [18-offline-save-quote](solo-owner/18-offline-save-quote.png) — QA-30
- [19-accept-lost-response](solo-owner/19-accept-lost-response.png), [19b-accept-retry](solo-owner/19b-accept-retry.png) — QA-04
- [20-payment-lost-response](solo-owner/20-payment-lost-response.png), [20b-payment-duplicate](solo-owner/20b-payment-duplicate.png) — QA-03
- [21-offline-navigation](solo-owner/21-offline-navigation.png) — QA-28
- Mobile: [m-06-sale-quote](solo-owner/m-06-sale-quote.png) (QA-16), [m-07-sale-after-payments](solo-owner/m-07-sale-after-payments.png), [m-07b-orders-after-sale](solo-owner/m-07b-orders-after-sale.png)

### `multirole/` (Óptica Javier: javier + claudia)
- [javier-quote](multirole/javier-quote.png) — QA-44; [javier-after-anticipo](multirole/javier-after-anticipo.png); [javier-assign-dialog](multirole/javier-assign-dialog.png) — QA-13
- [javier-incident-dialog](multirole/javier-incident-dialog.png), [javier-after-rework](multirole/javier-after-rework.png), [javier-order-history-mobile](multirole/javier-order-history-mobile.png), [javier-delivered-mobile](multirole/javier-delivered-mobile.png)
- [javier-offline-payment-mobile](multirole/javier-offline-payment-mobile.png) — QA-03
- [claudia-dashboard-mobile](multirole/claudia-dashboard-mobile.png), [claudia-production-mobile](multirole/claudia-production-mobile.png), [claudia-in-production-mobile](multirole/claudia-in-production-mobile.png), [claudia-prescription-mobile](multirole/claudia-prescription-mobile.png), [claudia-after-rework-mobile](multirole/claudia-after-rework-mobile.png) — QA-25, QA-45
- [claudia-offline-incident-mobile](multirole/claudia-offline-incident-mobile.png), [claudia-offline-reload-mobile](multirole/claudia-offline-reload-mobile.png) — QA-28, QA-30
- Probes: [orders](multirole/claudia-probe-orders.png), [customers](multirole/claudia-probe-customers.png), [catalog](multirole/claudia-probe-catalog.png), [dashboard](multirole/claudia-probe-dashboard.png) — QA-46

### `sales-friction/` (javier as seller)
- [desktop-quotation](sales-friction/desktop-quotation.png), [desktop-after-payments](sales-friction/desktop-after-payments.png), [desktop-fail-new_customer](sales-friction/desktop-fail-new_customer.png)
- [mobile-quotation](sales-friction/mobile-quotation.png) (QA-16), [mobile-after-payments](sales-friction/mobile-after-payments.png)
- [slow-quotation](sales-friction/slow-quotation.png), [slow-after-payments](sales-friction/slow-after-payments.png) — QA-21
- [double-click-after](sales-friction/double-click-after.png) — QA-03
- [offline-create-customer](sales-friction/offline-create-customer.png), [offline-save-quotation](sales-friction/offline-save-quotation.png), [offline-payment](sales-friction/offline-payment.png) — QA-30
- [accept-lost-response-retry](sales-friction/accept-lost-response-retry.png) — QA-04
- [homonym-blocked](sales-friction/homonym-blocked.png) (QA-19), [customers-duplicate-warning](sales-friction/customers-duplicate-warning.png) (QA-20)
- [rx-after-cyl-no-axis](sales-friction/rx-after-cyl-no-axis.png) (QA-44), [price-adjust-down-owner](sales-friction/price-adjust-down-owner.png), [rate-empty-native-validation](sales-friction/rate-empty-native-validation.png) (QA-22)
- [catalog-override-attempt](sales-friction/catalog-override-attempt.png) (QA-06), [usd-full-balance-residue-mobile](sales-friction/usd-full-balance-residue-mobile.png) (QA-18)

### `admin-platform/` (superadmin + QA orgs A/B)
- [01-admin-dashboard](admin-platform/01-admin-dashboard.png), [02-create-org-form](admin-platform/02-create-org-form.png), [03-after-create](admin-platform/03-after-create.png), [04-filter-panel](admin-platform/04-filter-panel.png), [05-org-detail](admin-platform/05-org-detail.png) — QA-54
- [06-dependency-error](admin-platform/06-dependency-error.png) (QA-57), [07-support-active](admin-platform/07-support-active.png)
- [08-org-detail-mobile](admin-platform/08-org-detail-mobile.png), [09-orgs-mobile](admin-platform/09-orgs-mobile.png), [16-team-mobile](admin-platform/16-team-mobile.png), [22-login-error-mobile](admin-platform/22-login-error-mobile.png)
- [10-qa-owner-dashboard](admin-platform/10-qa-owner-dashboard.png), [11-expired-customers](admin-platform/11-expired-customers.png), [12-expired-dashboard](admin-platform/12-expired-dashboard.png) — QA-40
- [13-suspended-customers](admin-platform/13-suspended-customers.png), [14-suspended-dashboard](admin-platform/14-suspended-dashboard.png) — QA-37
- [15-invite-qa.seller.20261002](admin-platform/15-invite-qa.seller.20261002.png) (QA-59), [19-owner-b-enrolled-elsewhere](admin-platform/19-owner-b-enrolled-elsewhere.png) (QA-39)
- [17-sales-module-off-dashboard](admin-platform/17-sales-module-off-dashboard.png), [18-sales-module-off-customers](admin-platform/18-sales-module-off-customers.png)
- [20-admin-base-catalog](admin-platform/20-admin-base-catalog.png), [21-admin-base-item-deactivated](admin-platform/21-admin-base-item-deactivated.png) — QA-53
- [23-offline-contract-save](admin-platform/23-offline-contract-save.png) — QA-30

### `performance-network/` (production build on :3100)
- [routes-fast-3100.json](performance-network/routes-fast-3100.json), [routes-throttle-3100.json](performance-network/routes-throttle-3100.json) — per-route bytes, requests, TTFB and FCP (QA-31, QA-33)
- [nav-fast.json](performance-network/nav-fast.json), [nav-throttle.json](performance-network/nav-throttle.json) — click-to-navigation latency (QA-29)
- [offline-sidebar-navigation-mobile](performance-network/offline-sidebar-navigation-mobile.png), [offline-customer-search-mobile](performance-network/offline-customer-search-mobile.png) — QA-28

### `refresh-cache-code/`
- [02-badge-stale-after-accept](refresh-cache-code/02-badge-stale-after-accept.png) (QA-24), [02-after-back-navigation](refresh-cache-code/02-after-back-navigation.png) (QA-26), [02-tabB-stale-balance-after-reject](refresh-cache-code/02-tabB-stale-balance-after-reject.png) (QA-27)
- [03-payment-lost-response-message](refresh-cache-code/03-payment-lost-response-message.png) (QA-03), [03-accept-lost-response-stuck](refresh-cache-code/03-accept-lost-response-stuck.png) (QA-04), [03-production-refetch-failure](refresh-cache-code/03-production-refetch-failure.png) (QA-09)
- [04-offline-navigation](refresh-cache-code/04-offline-navigation.png) (QA-28), [04-offline-create-customer-message](refresh-cache-code/04-offline-create-customer-message.png), [04-concurrent-deliver-raw-error](refresh-cache-code/04-concurrent-deliver-raw-error.png) (QA-30)
- [05-hung-payment-no-feedback](refresh-cache-code/05-hung-payment-no-feedback.png) (QA-21), [05-havana-2130-prescription-date-tomorrow](refresh-cache-code/05-havana-2130-prescription-date-tomorrow.png) (QA-11)
