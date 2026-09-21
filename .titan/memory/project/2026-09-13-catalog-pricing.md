# Catalog pricing and advisory rules

Date: 2026-09-13

## Decision

- Maintain a global base catalog and allow each organization to add its own items
  or override base-item cost, price, currency and availability.
- The operational base catalog was replaced on 2026-09-21 with 12 complete lens
  packages (Monofocal, Bifocal and Progresivo × Blanco, Fotocromático, Anti Blue
  and Foto Blue) plus Armadura sola. Each lens price covers the pair and is a
  starting price that may be increased when quoting; Foto Blue remains a distinct
  commercial name.
- Confirmed prices: Monofocal Blanco 7,000 CUP; Monofocal Fotocromático 60 USD,
  Anti Blue 50 USD and Foto Blue 70 USD; Bifocal Blanco 20 USD,
  Fotocromático 90 USD, Anti Blue 80 USD and Foto Blue 100 USD; Progresivo Blanco
  25 USD, Fotocromático 100 USD, Anti Blue 90 USD and Foto Blue 120 USD;
  Armadura sola 3,000 CUP. Internal costs remain `0` until supplied.
- Store monetary amounts as exact numeric values. Preserve the currency of every
  quoted line; never rewrite USD prices as CUP prices.
- Accept an explicit USD-to-CUP rate only for the calculated CUP-equivalent
  summary. The future quotation/order flow must snapshot prices and the selected
  rate when the customer confirms.
- Treat graduation and item-compatibility findings as advisory. A matching rule
  can disclose and apply a surcharge, but does not block the commercial flow.
- Owners manage catalog configuration. Operational sellers may read and calculate
  prices, while external providers and unrelated tenants have no access.

## Implementation

Migrations `20260913152157_catalog_pricing_and_graduation_rules.sql` and
`20260913152320_grant_catalog_rls_helpers.sql` add the catalog, tenant overrides,
compatibilities, graduation rules, RLS helpers and the security-invoker
`calculate_catalog_price` function. The `/catalog` workspace exposes selection,
optional prescription context, explicit conversion, breakdown, warnings and
owner-only configuration.

## Verification

Remote rollback-only fixtures verified base pricing, tenant overrides,
mixed-currency totals, a high-graduation surcharge/warning, seller calculation
and seller mutation denial. TypeScript, ESLint and the production build passed.
Interactive responsive browser QA remains pending because browser automation was
not available in this environment.

Migration `20260921012855_replace_catalog_with_optical_packages.sql` records the
replacement and is marked applied remotely. Verification returned exactly 13
current items, zero legacy items and no schema lint errors. The two test orders
and their quotations, lines, payments, confirmations, WhatsApp attempts and
dispatches were removed. No customers or prescriptions were deleted, and all
immutable-history triggers were re-enabled.
