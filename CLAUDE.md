@AGENTS.md

<!-- titan-factory-claude:start -->
# Titan Factory (Claude Code) — LensSpace

`AGENTS.md` (importado arriba) contiene las reglas comunes a Claude Code y Codex y el
aviso de Next.js. Este bloque agrega lo propio de Claude Code. Si algo choca, gana la
instruccion explicita del usuario, luego `AGENTS.md`, luego este bloque.

## Proyecto

LensSpace es un SaaS multi-tenant para opticas: clientes, recetas, cotizaciones, ventas,
pagos, caja, produccion, notificaciones y entrega. Es una app **existente y en marcha**,
no una plantilla nueva: no se regenera, se extiende.

- Reglas de negocio: `BUSINESS_LOGIC.md` (fuente de verdad del dominio).
- Diseño visual: `docs/design/` manda sobre cualquier design system generico
  (ver `.titan/memory/project/2026-09-13-design-system.md`). Los estilos de
  `.claude/design-systems/` solo aplican si el usuario los pide explicitamente.
- Idioma: identificadores, comentarios, commits y rutas tecnicas en ingles; el copy
  visible al usuario final en español.
- El equipo es tecnico: explica supuestos y tradeoffs en terminos tecnicos y concisos.

## Memoria compartida con Codex (SIEMPRE ACTIVA)

Claude Code y Codex comparten **una sola** memoria versionada en git:

| Que | Donde |
|-----|-------|
| Decisiones, feedback, referencias | `.titan/memory/` (indice: `MEMORY.md`) |
| PRPs / planes de features | `.titan/plans/` |
| Evidencia de QA (notas, capturas) | `.titan/qa/` |

- Al empezar una tarea relevante, lee `.titan/memory/MEMORY.md` y solo las entradas
  relacionadas (`tf-primer` lo hace al inicio de sesion; `tf-memory-manager` define formato).
- Auto-memory de Claude Code esta desactivada en `.claude/settings.json`. NUNCA crees
  `.claude/memory/` ni otra copia de la memoria.
- Puede haber entradas escritas por Codex: tratalas igual. El codigo actual gana sobre una
  nota vieja; marca lo superado en vez de borrarlo.
- Las tareas de solo lectura no escriben memoria. Nunca guardes credenciales.

## Coexistencia con Titan Factory Codex

| Claude Code | Codex |
|-------------|-------|
| `CLAUDE.md` (+ `@AGENTS.md`) | `AGENTS.md` |
| `.claude/skills/tf-*` | `plugins/titan-factory-codex/skills/tf-*` |
| `.claude/agents/tf-*.md` | `.codex/agents/tf-*.toml` |
| `.claude/skills/{supabase,…}` (puentes) | `.agents/skills/` (fuente real, `skills-lock.json`) |
| `.mcp.json` + variables de entorno | MCP configurado en cada instalacion de Codex |

Los skills tienen el mismo nombre en ambos lados. No edites `plugins/`, `.codex/` ni
`.agents/` salvo que la tarea sea sobre Codex o los skills compartidos. Para actualizar la
fabrica de Claude usa `tf-update-tf` (nunca copies el template encima).

## Que hacer con cada request

```
├── Feature compleja (DB + API + UI, varias fases)
│       → tf-prp (plan en .titan/plans/) → usuario aprueba → tf-bucle-agentico
├── Base de datos, migraciones, RLS, queries, metricas
│       → tf-supabase + skills supabase y supabase-postgres-best-practices
├── Revisar / testear / bug en UI
│       → tf-playwright-cli (evidencia en .titan/qa/)
├── Login / auth             → tf-add-login (ya existe auth: extender, no reemplazar)
├── Pagos / emails / PWA     → tf-add-payments / tf-add-emails / tf-add-mobile
├── Manual de usuario        → tf-add-manual (ya existe el generador del manual)
├── IA (chat, RAG, vision)   → tf-ai
├── Landing / marketing      → tf-website-3d (respetando docs/design/)
├── Logo / marca             → logo-design
├── Imagenes                 → tf-image-generation
├── Automatizaciones / n8n   → tf-n8n-mcp-tools-expert primero, luego tf-n8n-workflow-patterns
├── Deploy                   → Vercel (preferido) / tf-easypanel-deploy (alternativa)
├── "Recuerda…", "en que quedamos" → tf-memory-manager
├── Contexto del proyecto    → tf-primer
├── Actualizar / quitar la fabrica → tf-update-tf / tf-eject-tf (DESTRUCTIVO, confirmar)
└── Nada encaja → leer el codigo, seguir sus patrones y ejecutar
```

Integraciones opcionales (Polar, Resend, OpenRouter, n8n…) no reemplazan en silencio lo
que el proyecto ya usa (p. ej. OpenWA para notificaciones de pedidos).

## Los 4 comportamientos

1. **Pensar antes de codificar.** Declara supuestos. Si hay varias interpretaciones,
   presentalas; si algo no esta claro, pregunta antes de implementar.
2. **Simplicidad primero.** El minimo codigo que resuelve el problema. Sin features,
   abstracciones ni configurabilidad que nadie pidio.
3. **Cambios quirurgicos.** Toca solo lo necesario, sigue el estilo existente, limpia solo
   los huerfanos que tu cambio creo. Menciona el codigo muerto ajeno, no lo borres.
4. **Ejecucion orientada a objetivos.** Define criterios de exito verificables e itera
   hasta comprobarlos (lint, typecheck, build, Playwright). Para tareas de varios pasos,
   plan breve: `paso → verificar: check`.

## Subagentes: solo con permiso

`.claude/agents/` tiene 7 subagentes `tf-*` (backend, frontend, supabase-admin,
codebase-analyst, vercel-deployer, gestor-documentacion, validacion-calidad).
Se usan solo cuando el usuario lo pide. Si consideras util delegar, **pide permiso antes,
cada vez**: una aprobacion anterior no cubre la siguiente delegacion.

## Stack real del proyecto

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS 3.4 ·
Supabase (`@supabase/ssr`, Auth + Postgres + RLS) · lucide-react · Vercel. Antes de usar
una API de Next.js lee la guia en `node_modules/next/dist/docs/` (ver `AGENTS.md`).
No agregues dependencias (Zod, Zustand, SDKs de IA…) sin necesidad real y sin decirlo.

Arquitectura feature-first:

```
src/
├── app/        # App Router: (auth)/, (main)/, manual/, metadata routes
├── features/   # admin, analytics, auth, cashbox, catalog, client-docs, customers,
│               # dashboard, landing, notifications, orders, prescriptions,
│               # production, sales, team
├── shared/     # components, hooks, lib, stores, types, utils, config, constants
└── lib/        # supabase clients, utils
supabase/       # config.toml, migrations/, functions/, tests/
```

## Reglas de codigo

- KISS, YAGNI, DRY. Archivos ≤ 500 lineas, funciones ≤ 50 lineas como guia.
- `camelCase` variables/funciones, `PascalCase` componentes, `kebab-case` archivos.
- Nunca `any` (usa `unknown`). Valida en el servidor toda entrada de usuario.
- RLS habilitado en toda tabla de Supabase; autorizacion en el servidor, no solo en la UI.
- Nunca expongas secretos en el codigo, la memoria ni `.mcp.json`.

## Comandos

```bash
npm run dev        # next dev --turbopack
npm run lint
npm run typecheck
npm run build
```

## MCPs

`.mcp.json` (versionado) define `supabase`, `next-devtools` y `playwright`. No contiene
secretos: `supabase` es el servidor remoto `https://mcp.supabase.com/mcp` con login OAuth
en el navegador (`/mcp` → supabase → Authenticate); no usa tokens ni variables de entorno.
La CLI (`supabase login` + `supabase link`) cubre `db push`, `migration list` y
`gen types`. Ver `docs/AGENT_SETUP.md`.

## Auto-blindaje

Cada error no obvio se arregla y se documenta para que no se repita:

| Alcance | Donde |
|---------|-------|
| Una feature | Su PRP en `.titan/plans/` |
| Patron o correccion del proyecto | `.titan/memory/` (`feedback/` o `reference/`) |
| Varias features / un flujo | El skill `tf-*` relevante |
| Todo el proyecto | `AGENTS.md` (si aplica a ambos agentes) o este archivo |
<!-- titan-factory-claude:end -->
