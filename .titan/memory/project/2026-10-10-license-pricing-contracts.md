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
- Multi-branch is sold but has no branch-creation screen yet: see
  `.titan/plans/prp-multi-branch-management.md`.

Plan: `.titan/plans/prp-license-pricing-and-contracts.md`.
