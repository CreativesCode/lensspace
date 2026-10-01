# LensSpace product name

Date: 2026-09-21

The product brand changed from Vision Studio to LensSpace before the initial
Vercel deployment. User-facing copy, application metadata, package identity and
the active visual identity use `LensSpace`.

The initial Vercel project uses `lensspace.vercel.app`. A direct HTTP check on
2026-09-21 verified that the hostname resolves to the deployed application. The
new public landing and SEO work remain local until a subsequent deployment.

Historical migration filenames, deployed Supabase Vault secret names and
database integration keys keep the `vision_studio` prefix. Renaming those keys
without a coordinated database migration would interrupt the deployed OpenWA
notification integration and provides no user-visible branding benefit.

The existing eye symbol, Caribe moderno palette and typography remain the
approved visual foundation. The final D2 mark uses two open optical surfaces,
a split lens ring, the original vertical optical axis and a coral focal point
inside a deep-teal rounded tile. This mark and its horizontal, inverse,
monochrome, favicon and application-icon variants are the official identity.

The public `/` landing uses the approved D2 identity and Caribe moderno system.
It explains the optical workflow, real product capabilities, access by
responsibility and concrete privacy boundaries without publishing prices.

## Update 2026-10-01 — D2.1 refinement

The user approved D2.1, a craft refinement of D2 (same concept, palette and
typography): ring halves end with butt caps under the axis, the right half uses
`#128F84` instead of `#0D7A72`, the coral highlight dot is removed, a dedicated
16-32 px cut (`lensspace-mark-small.svg`, used for `icon.svg`) exists, the
horizontal lockups use an outlined Space Grotesk wordmark instead of live text,
and untiled single-ink symbols were added. `#0D7A72` remains a UI palette colour.
Evidence: `.titan/qa/logo-d21/2026-10-01-logo-d21.md`.
