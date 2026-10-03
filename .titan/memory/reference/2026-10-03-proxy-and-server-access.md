# Proxy location and server access helpers

Date: 2026-10-03

- **The Next 16 proxy must live in `src/proxy.ts`.** With a `src/` directory, a root
  `proxy.ts` is silently ignored (docs: `03-file-conventions/proxy.md`). Until
  2026-10-03 it sat in the root, so session refresh, the `/login` → `/dashboard`
  redirect and `?next=` deep links never ran (QA-59). Check: `curl -I /orders` signed
  out must answer `307 /login?next=%2Forders`.
- **Protected prefixes** are listed in `src/lib/supabase/proxy.ts`; add every new
  signed-in route there (e.g. `/profile`).
- **Role checks in server components:** `getAccessSummary()` in
  `src/lib/supabase/access.ts` (React `cache`, shared with the `(main)` layout, so
  no extra queries). `requireCommercialRole()` sends provider-only users to
  `/production`; `isProviderOnly()` drives the dashboard redirect.
- **Redirects inside pages stream:** with `(main)/loading.tsx`, `redirect()` in a page
  becomes a client-side redirect after the stream starts; Playwright must
  `waitForURL`, not read `page.url()` right after `goto`.
- **Dates rendered on server and client:** use `formatBusinessDate` /
  explicit `timeZone: BUSINESS_TIME_ZONE` (`src/shared/utils/dates.ts`); bare
  `toLocaleDateString('es-CU')` causes hydration mismatches (Vercel renders in UTC).
