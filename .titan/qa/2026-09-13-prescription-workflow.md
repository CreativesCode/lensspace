# Prescription workflow QA

Date: 2026-09-13

## Verified

- `npm run typecheck`, `npm run lint` and `npm run build` passed.
- `/prescriptions` is emitted as a dynamic authenticated route.
- A remote transactional fixture authenticated as an active seller created an
  initial prescription revision and a second immutable revision.
- The fixture verified sequential revision numbers and rejection of a correction
  without a reason, then rolled all fixture rows back.
- A separate rolled-back fixture verified that a valid private-object path is
  readable/writable for the seller, while cross-tenant and malformed paths are
  rejected.
- Authenticated users cannot execute the private Storage authorization helper
  directly.
- The bucket is private, limited to 10 MB and restricted to JPEG, PNG, WebP and
  PDF MIME types.

## UI behavior implemented

- Customer and existing-prescription selection.
- Complete optical fields for both eyes, prism/base, total or per-eye pupillary
  distance, heights, date, prescriber and notes.
- New corrections require a reason and append a revision instead of updating the
  prior record.
- Optional private original upload and authenticated download.
- If metadata registration fails after upload, cleanup is attempted through a
  policy that permits deletion only while the object is still unregistered.
- Read-only organizations can review history but cannot create revisions.

## Pending

- Interactive desktop/mobile UI and real browser upload/download QA. No browser
  surface was available in this session.

No fixture data was retained and no credentials are recorded here.
