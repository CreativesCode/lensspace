# PRP — LensSpace brand system and marketing landing

Status: landing and technical SEO complete locally; production CTA and deployment QA pending
Date: 2026-09-21

## Objective and value

Define a recognizable LensSpace identity and introduce a public, responsive
marketing landing at `/` that explains the real optical workflow, product
capabilities and role-based access model. The page must build trust and generate
qualified contact or pilot requests without publishing plans or prices.

The current root redirects directly to `/dashboard`. The intended public journey
is instead:

1. Visitor understands what LensSpace is and who it serves.
2. Visitor sees the complete operational path from prescription to delivery.
3. Visitor understands that each person sees only the work and information they
   need.
4. Visitor can request a demonstration or enter the existing login flow.

## Brand foundation

### Positioning

LensSpace is the shared operating space for an optical business: customers,
prescriptions, sales, collections, workshop coordination and delivery remain
connected without exposing every detail to every participant.

### Brand promise

**Every optical order, clearly connected.**

Spanish commercial expression:

**Toda tu operación óptica, claramente conectada.**

The existing phrase `De la receta a la entrega` remains a useful product proof
line, not the primary corporate promise.

### Logo direction

Evolve the current eye mark instead of discarding its recognition:

- Two opposing lens curves represent the optical business and the participants
  working from different sides of the same order.
- The open negative space between them represents the shared `Space` in the name.
- A coral focal point represents the customer/order moving through the workflow.
- Remove the current unexplained vertical divider; use a circular focus/orbit
  construction that remains readable at favicon size.
- Use `LensSpace` as one word with a capital `L` and `S`.
- Primary horizontal lockup: mark + wordmark.
- Required variants: dark-on-light, light-on-dark, monochrome and icon-only.
- The mark must work at 16 px, in one color and without gradients.

The approved palette remains:

- Deep teal `#07322F`: trust, structure and primary dark surfaces.
- Action teal `#0D7A72`: controls and links.
- Mint `#35C2A8`: progress and positive operational state.
- Coral `#FF6B4A`: focal point, attention and controlled exceptions.
- Mist `#F0FBF9`: spacious product background.

Typography remains Space Grotesk for display/wordmark and Source Sans 3 for
body copy and operational density.

### Voice

- Clear, operational and human.
- Speak about outcomes before technical implementation.
- Avoid generic transformation claims and exaggerated automation language.
- Prefer `pedido`, `receta`, `cobro`, `taller`, `entrega` and `equipo` over SaaS
  terminology.
- Explain security through concrete visibility boundaries, not vague claims.

## Scope and stack

### Included

- Refined vector logo and reusable logo component.
- Exportable SVG assets and application icon.
- Public `/` landing in the existing Next.js 16 application.
- Responsive header with `Conocer LensSpace`, `Capacidades`, `Accesos` and
  `Iniciar sesión` navigation.
- Product narrative and workflow visualization.
- Capability sections grounded in implemented behavior.
- Role/access explanation without exposing internal policy details.
- No-price CTA for demo/pilot contact.
- Spanish-first SEO metadata and social-card preparation.
- Keyboard, screen-reader, reduced-motion and contrast coverage.

### Excluded for this phase

- Pricing or package comparison.
- Public self-service signup.
- Claims about features not implemented.
- Customer logos, testimonials or metrics without explicit evidence.
- Blog, documentation center or multilingual routing.
- Database schema or RLS changes.

### Existing stack

- Next.js 16 App Router, React 19, TypeScript and Tailwind CSS.
- Existing Space Grotesk / Source Sans 3 font setup.
- Existing Caribe moderno color system.
- Vercel production deployment and Supabase-backed authenticated application.

Before implementation, read the relevant Next.js 16 guides from the installed
`node_modules/next/dist/docs/` tree for metadata, images and route behavior.

## Landing narrative

### 1. Header

- Compact LensSpace lockup.
- Anchors: `Cómo funciona`, `Capacidades`, `Accesos`.
- Secondary action: `Iniciar sesión` → `/login`.
- Primary action: `Solicitar demostración` → contact CTA section.

### 2. Hero

Eyebrow: `OPERACIÓN ÓPTICA CONECTADA`

Headline:

**De la receta a la entrega, todo en el mismo espacio.**

Supporting copy:

`LensSpace conecta clientes, ventas, cobros y producción para que cada pedido
avance con información clara y cada persona acceda solo a lo que necesita.`

Actions:

- `Solicitar demostración`
- `Ver cómo funciona`

Visual: a product-native order journey, not a generic analytics dashboard. Show
a compact order card moving through prescription, sale, workshop, payment and
delivery with actor/state attribution.

### 3. Operational pain and value

Frame the problem without attacking existing teams:

- Information split across notebooks, messages and people.
- Unclear balances and order state.
- Workshop coordination without a shared history.

Resolution statement: `Un pedido. Un historial. El acceso correcto para cada
persona.`

### 4. Complete workflow

Use six connected stages:

1. Customer and prescription.
2. Quotation and confirmed sale.
3. Payment and remaining balance.
4. Lens and mounting production.
5. Customer notification.
6. Paid and controlled delivery.

Each stage should name one concrete safeguard or operational benefit.

### 5. Capability groups

Avoid a wall of feature cards. Use three narrative groups:

- **Sell with context**: customers, phones, prescriptions, catalog rules,
  quotations and controlled price adjustments.
- **Follow every order**: payments, balances, workshop jobs, incidents, rework,
  notifications and immutable timeline.
- **Run the business**: cash closures, branch/seller filters, analytics, team
  invitations and organization controls.

### 6. Access by responsibility

Present role cards and a compact visibility matrix. Do not call these pricing
tiers.

#### Platform administrator

- Provisions and supervises optical organizations.
- Controls enabled modules and tenant operational status.
- Maintains the shared base catalog.
- Does not participate in daily optical sales by default.

#### Owner

- Sees the organization across its active branches.
- Manages catalog, team, analytics and operational review.
- Can follow sales, payments, production, incidents and cash closures.
- Can perform authorized commercial actions when operating the business.

#### Seller

- Works in an assigned branch.
- Manages customers, prescriptions and their own commercial flow.
- Creates sales, records authorized payments and follows relevant orders.
- Does not administer organization contracts, team or internal owner analytics.

#### Lens laboratory/provider

- Sees only assigned lens jobs and fabrication prescription details.
- Updates only the transitions belonging to its own work.
- Does not see customer identity, prices, payments or unrelated orders.

#### Mounting provider

- Sees only assigned mounting jobs and the operational details required.
- Updates only its permitted work transitions.
- Does not see customer identity, commercial data or unrelated jobs.

Marketing language must emphasize `permissions by responsibility`, not imply that
the UI alone provides security. The underlying enforcement remains Supabase RLS
and guarded database functions.

### 7. Trust section

Use concrete statements supported by implementation:

- Organization and branch isolation.
- Role-specific visibility.
- Immutable commercial and operational history.
- Delivery blocked while a balance remains.
- Provider views exclude customer and payment information.

Avoid certifications, uptime or encryption claims not independently documented.

### 8. Final CTA

Headline: `Mira cómo LensSpace encaja en la operación de tu óptica.`

Primary action: `Solicitar demostración`.

Secondary action: `Ya tengo acceso` → `/login`.

The initial CTA may use a configured email/contact link or a small server-side
form. The implementation must not invent a destination; contact ownership and
delivery mechanism are an explicit open decision.

### 9. Footer

- LensSpace lockup and product promise.
- Login link.
- Privacy/contact placeholders only when real destinations exist.
- Current year generated at render time.

## Expected behavior and acceptance

- `/` is public and no longer redirects visitors to `/dashboard`.
- Authenticated application routes and their guards remain unchanged.
- `/login` remains directly reachable from every viewport.
- All claims correspond to implemented and verified product behavior.
- The role matrix clearly separates owner, seller, lens provider, mounting
  provider and platform administrator.
- No pricing, invented plan names or public signup appears.
- The logo remains identifiable at 16 px and passes a monochrome test.
- The page works at 320, 768, 1024 and 1440 px without horizontal overflow.
- Primary navigation and CTA flow are usable by keyboard.
- Motion honors `prefers-reduced-motion`.
- Decorative visuals do not produce redundant screen-reader output.
- Metadata identifies LensSpace as optical operations software in Spanish.
- `npm run lint`, `npm run typecheck` and `npm run build` pass.
- Production QA verifies the root, anchor navigation, login handoff and CTA.

## Evidence and architecture

- Current redirect: `src/app/page.tsx`.
- Current logo component: `src/shared/components/LensSpaceLogo.tsx`.
- Current icon: `src/app/icon.svg`.
- Global metadata/fonts: `src/app/layout.tsx`.
- Existing identity source: `docs/design/Identidad Vision Studio.dc.html`.
- Current role-aware application navigation: `src/app/(main)/layout.tsx` and
  `src/shared/components/MainNavigation.tsx`.
- Membership roles are constrained in
  `supabase/migrations/20260913021832_core_multi_tenant_foundation.sql`.
- Provider data boundaries and transitions are enforced in
  `supabase/migrations/20260913165913_production_provider_workflows.sql` and
  subsequent alignment migrations.
- Current verified product behavior is summarized in
  `.titan/memory/reference/2026-09-13-project-status.md`.

Implementation should keep the public landing composition separate from the
authenticated `(main)` shell. Static marketing content belongs in a focused
landing component structure; authenticated data must not be loaded on `/`.

## Phases

### Phase 1 — Brand mark and asset system

Outcome: approved vector geometry, lockups, icon and usage rules.

Status: completed on 2026-09-21 with the approved D2 Optical Space mark. The
application component, SVG kit, monochrome variants, favicon, Apple icon and
192/512 application icons use the same verified geometry.

Verification:

- Inspect at 16, 24, 32, 128 and large display sizes.
- Verify light, dark and monochrome variants.
- Compare SVG asset and React component geometry.
- Render the identity board and inspect spacing/contrast.

### Phase 2 — Landing composition and copy

Outcome: complete public page using the approved mark and real product narrative.

Status: completed locally on 2026-09-21, including responsive desktop/mobile
review and reduced-motion support.

Verification:

- Copy-to-evidence review against current implementation status.
- Responsive render review at defined widths.
- Keyboard and reduced-motion checks.

### Phase 3 — CTA and production hardening

Outcome: working demo/contact path, metadata/social assets and production QA.

Required decision before implementation: destination and owner for demo requests
(email, WhatsApp, form inbox or CRM).

Status: technical SEO, social imagery and local production build completed on
2026-09-21. Demo-request delivery, deployment of the current build, live-domain
QA and Search Console registration remain pending.

Verification:

- Confirm CTA delivery with a controlled test.
- Verify Vercel production redirects and `/login` handoff.
- Confirm no private application data appears in page source or client requests.

## Rollout

- Implement and validate locally.
- Deploy as a Vercel preview and inspect desktop/mobile before promotion.
- Promote to production only after copy and logo review.
- Recovery is a normal Vercel rollback to the previous deployment; no database
  rollback is required.

## Open decisions

1. Where should `Solicitar demostración` send the lead?
2. Should the public launch target Cuba explicitly or use region-neutral Spanish?
3. Are real customer testimonials/logos available with permission? Default: omit.
4. Should a short product video be added later? Default: defer until authenticated
   flows have final responsive QA.

## Decisions and lessons

- 2026-09-21: LensSpace remains one word and retains the Caribe moderno palette.
- 2026-09-21: The landing explains access levels as responsibilities, not plans.
- 2026-09-21: Pricing is deliberately excluded.
- 2026-09-21: Product screenshots and claims must come from implemented behavior.
