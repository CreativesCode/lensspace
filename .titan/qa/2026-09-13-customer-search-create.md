# Customer search and creation QA

Date: 2026-09-13

## Verified

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed; `/customers` is emitted as a dynamic authenticated route.
- A transactional remote fixture authenticated as an active seller created two
  customers sharing one normalized phone and three total phone rows, then rolled
  the transaction back.
- A transactional remote fixture forced the second phone insert to violate its
  constraint and verified that the customer row was also rolled back.
- The function is `SECURITY INVOKER`; existing customer and phone RLS remains the
  authorization boundary. Execute is granted only to `authenticated`.

## UI behavior implemented

- Search by customer name or normalized phone.
- Select and review an existing customer for reuse.
- Create a customer with one to five phones in one database transaction.
- Exact name or phone matches require reviewing possible duplicates and a second
  confirmation; shared phone numbers remain allowed.
- Organization/branch selection is derived from active owner/seller membership.
- Expired, suspended or module-disabled organizations remain searchable but the
  create action is disabled.

## Pending

- Interactive desktop/mobile browser QA. The available computer-use integration
  reported that no browser was available in this session.

No fixture data was retained and no credentials are recorded here.
