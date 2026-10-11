# License pricing, contracts and founder partner

Date: 2026-10-10

Decision (product owner): LensSpace is licensed monthly per module, not sold.

- Basic 10 USD/month = core + optical sales + WhatsApp (WhatsApp included while
  OpenWA costs nothing). Add-ons: cashbox 3, production 5, analytics 3, multi-branch
  5 per extra branch. Complete (one branch) 19. Annual pays 10 months for 12.
- Founder partner (the optician who gave the idea): complete plan at 15 USD fixed for
  24 months only, then the list price (19). Written into the contract clause.
- Referral reward: 15 days for a referrer with an active founder lock, 10 days for any
  other store, once the referred store pays its first period.
- Infrastructure stays on free tiers (Supabase free, Vercel Hobby, OpenWA at no
  cost) for now; Vercel Hobby is non-commercial by ToS — move to Pro around the
  third or fourth paying store.
- Contracts: draft in /organizations → proforma with the LensSpace brand
  (/contracts/[id]/print) → upload the signed copy (private bucket
  `license-contracts`) → subscription amount/period sync. Provider legal data are
  editable in the admin ("Datos del proveedor"). The proforma text is pending legal
  review by the product owner.
- Multi-branch: implemented the same day, see
  `project/2026-10-10-multi-branch-admin-only.md`.

Plan: `.titan/plans/prp-license-pricing-and-contracts.md`.

Update 2026-10-11 (product owner): trial is free and optional (15 days / 1 month /
none at onboarding); trial amount is forced to 0 by a trigger. Paid = "Registrar pago"
(`record_subscription_payment`): requires the signed contract, charges the period
amount (founder → post-lock price after the lock), activates and extends one period.
Trial only at onboarding (same day): `start_subscription_trial` was dropped and a
trigger (`subscriptions_guard_trial`) rejects any move into 'trial' or a trial on a
subscription that was ever paid; the end date of the original trial stays editable.
Migrations `20261011202949_trial_and_paid_subscriptions.sql` and
`20261011203634_trial_only_at_onboarding.sql`.
Onboarding edge function now accepts `trial` or `expired` (no trial), not `active`.

Update 2026-10-11 — grace and notices: `private.subscription_grace_days()` = 5 is used
by `can_operate_in_organization` (operates until expires_on + 5), the payment (a
payment in grace continues from expires_on + 1) and the daily pg_cron job
`lensspace-subscription-notices` (14:00 UTC) → `private.run_subscription_notices()`
→ `private.subscription_notices` (unique notice_key per day/kind) → pg_net →
Edge Function `send-subscription-notice` (verify_jwt false, x-wa-secret, same OpenWA
Vault config). On the block day the subscription is set to `expired`. Owner phone:
profile, else signed contract; admin phone: platform_provider_profile. Web banner
dismissable once a day (localStorage). Migration `20261011210800_subscription_grace_and_notices.sql`.

Update 2026-10-11 — pending start and fair payment (supersedes "onboarding accepts
`expired`" and "payment after the block starts today"): a new subscription status
`pending` ("En preparación") is used for organizations created without a trial
(onboarding sends `trial` or `pending`). Pending = read-only, amount 0, no notices,
can never be entered from another status (guard trigger) nor become a trial. Payment
start: pending → today; otherwise `greatest(expires_on + 1, today - grace)`, so the
grace days used are always charged, blocked days are not, and paying during a trial
or a paid period never loses days. Mirrored in `nextPaymentPreview`. Migration
`20261011212452_pending_start_and_fair_payment.sql`; the existing "test" org was moved
to pending.
