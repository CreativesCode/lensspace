# Catalog pricing and advisory rules

Date: 2026-09-13

## Decision

- Maintain a global base catalog and allow each organization to add its own items
  or override base-item cost, price, currency and availability.
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
