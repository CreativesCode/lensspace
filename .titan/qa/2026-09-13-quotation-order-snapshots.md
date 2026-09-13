# Quotation and order snapshot verification

Date: 2026-09-13

- Remote migrations applied successfully after correcting the prescription
  revision FK to its global primary key. The failed first application was atomic
  and created no partial schema.
- Seller fixture saved and accepted a quotation. It produced an organization/year
  order number, copied all lines, stored the explicit exchange rate and created
  exactly one verbal confirmation.
- Direct order-line mutation was denied; accepted commercial snapshots remained
  unchanged.
- A second fixture changed an effective catalog price after quotation. Acceptance
  returned the expected reconfirmation error, left the quotation pending and
  created no order.
- All fixture transactions were rolled back and identities are not recorded here.
- `npm run typecheck`, `npm run lint` and `npm run build` passed; `/sales` is a
  dynamic production route.
- Interactive desktop/mobile QA remains pending because browser automation is not
  available reliably in this environment.
