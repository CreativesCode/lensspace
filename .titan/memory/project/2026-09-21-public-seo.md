# Public SEO for LensSpace

Date: 2026-09-21

## Decision

`https://lensspace.vercel.app` is the canonical public origin until a custom
domain is adopted. The site configuration may accept a non-local
`NEXT_PUBLIC_SITE_URL`, but falls back to that verified Vercel origin so local
development never emits localhost canonicals.

Only the marketing landing at `/` is intended for search indexing in the
current product. Authentication, callback and authenticated operational routes
are excluded from the sitemap, disallowed for crawlers and emit `noindex` from
their route-group layouts. Access control continues to depend on Supabase and
server guards; robots directives are not a security boundary.

## Public search identity

- Primary subject: software de gestión para ópticas.
- Search title: `Software de gestión para ópticas | LensSpace`.
- Core promise: `Toda tu operación óptica, claramente conectada.`
- Language: Spanish; Open Graph locale: `es_CU`.
- The landing describes only implemented capabilities and does not publish
  pricing, testimonials, certifications or unsupported performance claims.

## Implemented technical surface

- Canonical URL, descriptive title and meta description.
- Open Graph and large Twitter card metadata.
- Brand-aligned generated 1200 × 630 social image.
- Root sitemap containing only the canonical landing.
- Robots policy for public and private routes.
- JSON-LD graph for Organization, WebSite and WebApplication using factual
  product properties without ratings or offers.
- Updated web-app manifest language, scope and categories.

## Evidence and remaining work

Local lint, TypeScript and Next.js production build passed. Local responses for
`/`, `/robots.txt`, `/sitemap.xml`, `/opengraph-image` and `/login` were checked;
the login HTML contains `noindex`. The social image was visually inspected at
1200 × 630.

Production still serves the previous root redirect until the current changes
are deployed. After deployment, verify the live head, robots, sitemap, social
card and login `noindex`, then register the canonical property and submit the
sitemap in Google Search Console. Verification tokens must come from the real
search-console account and must not be invented.
