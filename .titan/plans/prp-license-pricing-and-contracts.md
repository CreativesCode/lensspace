# PRP — License pricing and contracts

Date: 2026-10-10
Status: implemented 2026-10-10 (browser QA pending a superadmin session)

## Goal

Record what each optical store pays, for how long and under which conditions, with a
downloadable contract proforma and the signed copy stored in the platform. Make the
founder partner terms (15 USD complete plan, 2 years only) and the referral reward
explicit and auditable.

## Agreed price list (2026-10-10)

| Item | Monthly | Notes |
|------|---------|-------|
| Basic: core + optical sales + WhatsApp | 10 USD | WhatsApp included while OpenWA has no cost |
| + Cashbox | 3 USD | |
| + Production and providers | 5 USD | |
| + Analytics | 3 USD | |
| + Multi-branch | 5 USD per extra branch | |
| Complete (one branch) | 19 USD | sum would be 21 |
| Founder partner (complete) | 15 USD | fixed for 24 months, then the list price |

- Billing periods: monthly (×1), quarterly (×3), semiannual (×6), annual (×10, two
  months free).
- Referral (changed by the product owner 2026-10-10): when a referred store pays its
  first period, the referrer's subscription is extended 15 days if the referrer holds
  an active founder price lock, 10 days otherwise. Once per referred store; stackable.

## Behavior

1. Platform admin opens an organization → "Contrato de licencia".
2. "Preparar contrato": plan (basic / complete / founder / custom), modules, extra
   branches, billing period, start date, term (12 months default; founder fixed 24),
   client legal data, optional "referida por". The amount is suggested from the price
   list and can be overridden (custom).
3. Draft saved → "Descargar proforma" opens a print view (same pattern as the manual:
   browser print → PDF).
4. "Subir contrato firmado" (PDF/image, ≤10 MB) → contract becomes `signed`, any
   previous signed contract becomes `superseded`, and the subscription amount,
   currency and billing period are synced from the contract. Activation/expiry stay
   manual (they depend on payment).
5. Founder contract shows the price-lock end date and the price that applies after it.
6. Referrer view lists referred stores; "Aplicar medio mes" is enabled once the
   referred contract is signed and its subscription has been renewed at least once
   (`last_renewed_on` set = first payment); it extends the referrer by 15 days, once
   per referred store, audited.

## Data model

- `public.license_contracts`: organization, status (`draft|signed|superseded|cancelled`),
  plan, module_keys, extra_branches, monthly_amount, currency, billing_period,
  period_amount, starts_on, term_months, ends_on, price_locked_until,
  post_lock_monthly_amount, client legal fields, referred_by_organization_id,
  referral_credit_applied_on, signed_file_path, signed_at, audit columns.
  RLS: platform admin only. One signed contract per organization (partial unique index).
- Storage bucket `license-contracts` (private, PDF/JPEG/PNG/WEBP, 10 MB), admin only.
- RPCs (security invoker, admin-checked, audited): `save_license_contract`,
  `sign_license_contract`, `cancel_license_contract`, `apply_referral_credit`.
- Price list lives in TypeScript (`src/features/admin/license-pricing.ts`); contracts
  snapshot amounts, so a later price change never alters a signed contract.

## Out of scope / known gaps

- There is no UI to create additional branches (only onboarding creates one), so the
  extra-branch count is contractual only, not enforced.
- No license payment ledger; `last_renewed_on` is the payment signal.
- Provider legal data live in `platform_provider_profile`, edited from
  /organizations → "Datos del proveedor" (product owner request).
- The proforma carries the LensSpace brand (logo, colors) and is a base text pending
  legal review in Cuba.

## Phases

1. Migration (table, bucket, policies, RPCs) + SQL test → verify: test passes, advisors clean.
2. Types regen + pricing module + contract panel UI + print view → verify: lint, typecheck, build.
3. Playwright run on /organizations (desktop + mobile) → evidence in `.titan/qa/`.
4. Memory entry with the pricing decision.

## Implementation notes

- Migration `20261011023821_license_contracts.sql`; test `supabase/tests/license_contracts.sql`
  (ran in a rolled-back transaction against the project before applying).
- UI: `src/features/admin/components/LicenseContract{Panel,Form}.tsx`,
  `ProviderProfileForm.tsx`, `ContractPrintView.tsx`; text in
  `src/features/admin/contract-document.ts`; prices in `license-pricing.ts`;
  print route `/contracts/[id]/print` (platform admin only).
- The three RPCs are SECURITY DEFINER (status changes bypass the draft-only update
  policy) with an explicit `private.is_platform_admin()` check; the advisor lists them
  as intended.
