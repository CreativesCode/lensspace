# Design system and view precedence

Date: 2026-09-13

## Decision

The user established docs/design/ as the mandatory visual source of truth for
Vision Studio. This rule applies to the current interface and every future view.

Use this precedence:

1. If docs/design/Vision Studio.dc.html contains a specific screen or pattern,
   follow that composition and behavior.
2. If a screen is not explicitly designed there, assemble it from the patterns
   in docs/design/Componentes Vision Studio.dc.html.
3. docs/design/Identidad Vision Studio.dc.html controls brand identity, logo,
   typography and palette.
4. Product usability, accessibility, responsive behavior and authorization must
   remain intact when adapting a mockup.

Do not introduce a parallel visual language or generic framework defaults when
the design library already specifies the relevant component.

## Verified identity

- Concept: **Caribe moderno**.
- Logo: outlined eye with coral iris. Use the extracted reusable component rather
  than redrawing variants ad hoc.
- Display and numeric type: Space Grotesk 400–700.
- Body, forms and dense tables: Source Sans 3 400–700.
- Ink/chrome/title: #07322F.
- Primary action: #0D7A72.
- Positive/completed: #35C2A8.
- Incident, balance and alert: #FF6B4A.
- Highlight surface: #F0FBF9; application canvas: #F7FBFA.
- Borders: #DCECEA / #E3EFED; muted text: #74857F.
- Radius: 5 px chips, 7 px buttons/fields, 10 px cards, pill only for status.
- Shadows: restrained green-tinted elevations; spacing follows multiples of four.
- Desktop navigation uses an ink sidebar; mobile uses a compact header/bottom
  navigation pattern with 48 px touch targets where applicable.
- Use one primary action per block. Catalog/clinical recommendations inform and
  allow continuation; they do not visually masquerade as blocking errors.

## Reviewed artifacts

- Identidad Vision Studio.dc.html: approved identity, logo lockups, palette and
  typography.
- Componentes Vision Studio.dc.html: foundations, buttons, fields, selection,
  statuses, tables, navigation, alerts/dialogs, timelines, compound blocks and
  mobile patterns.
- Vision Studio.dc.html: master application shell and concrete operational,
  owner, provider, platform and mobile compositions.
- .thumbnail: WebP overview of the component library.
- support.js: generated Design Canvas runtime; it is tooling support, not an
  application UI source and must not be copied into production.

Source: explicit user instruction and verified contents of docs/design/.
