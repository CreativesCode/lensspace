# Development setup and handoff

Date: 2026-09-12

## Verified state

- The application scaffold uses Next.js, Supabase and Vercel as recorded in the
  application-stack decision.
- `BUSINESS_LOGIC.md` contains the confirmed MVP workflow, multi-tenant rules,
  modular entitlements, subscription model, roles, pricing, payments, production,
  WhatsApp integration boundary and deferred scope.
- The Supabase project reference is `mgrqkbwgkkbshhtdpibs`.
- The global Codex MCP server named `supabase` is enabled, scoped to that project
  and authenticated with OAuth.
- Enabled MCP feature groups are docs, account, database, debugging, development,
  functions and branching.
- The local `.env.local` declares the expected public Supabase URL, public anon
  key and site URL variables. Their values are intentionally not stored here.
- Supabase Agent Skills were installed into `.agents/skills/`: `supabase` and
  `supabase-postgres-best-practices`. `skills-lock.json` records the installation.
- The initialized starter previously passed dependency installation, lint,
  TypeScript checking and a production build.

## Important setup note

The installed Codex CLI initially failed Supabase dynamic OAuth registration when
using its default scopes. Authentication succeeded after explicitly requesting
the scope set accepted by Supabase. A new Codex session is required to expose a
newly configured MCP server and newly installed project skills to the agent.

No OAuth token, Supabase key or other credential is stored in project memory.

## Next action

Start the next session by loading the project primer. Then create a substantial
implementation plan (PRP) from `BUSINESS_LOGIC.md`. The first implementation phase
should design the multi-tenant Supabase schema, migrations, module entitlements,
authentication/profile model and RLS policies before building operational UI.

Before applying database changes, inspect the live project through the Supabase
MCP, version every structural change locally and test tenant isolation with
representative roles.
