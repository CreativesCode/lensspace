# PWA install button instead of an APK

Date: 2026-10-04

Ionic Appflow stopped offering free app creation (2026-10-01) and LensSpace was never a
Capacitor app: it relies on Server Actions/SSR, so it cannot ship as static HTML inside
an APK. The product owner chose the installable PWA instead, with a button so users
never need to know the browser steps.

- `InstallAppButton` (`src/shared/components/`) appears in the sidebar (desktop and the
  mobile drawer) and in the landing hero; it hides when the app already runs installed.
- `beforeinstallprompt` is captured by an inline script in the root layout
  (`src/shared/lib/pwa-install.ts`) so it is not lost before hydration; no
  `preventDefault`, so Chrome's own Android mini-infobar still shows.
- Modes (`useInstallMode`): native prompt (Chrome/Edge/Samsung), iOS guide (Share →
  Agregar a inicio), Safari macOS guide (Archivo → Agregar al Dock), generic menu guide.
- The manifest also lists the 512 icon as `maskable` (the mark sits in the safe zone).
- Install prompts only appear in production builds (the service worker registers only
  there). QA evidence: `.titan/qa/2026-10-04-pwa-install/`.
- If a real store APK is ever needed, the free route is a Capacitor shell or TWA
  (Bubblewrap) pointing at the deployed URL, built with a manual GitHub Actions workflow.
