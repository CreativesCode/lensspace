# Dual-agent tooling: Claude Code and Codex

Date: 2026-10-01

## Decision

LensSpace hosts both Titan Factory toolboxes in the repository: Titan Factory
Codex (`plugins/titan-factory-codex/`, `.codex/`, `.agents/`) and Titan Factory
for Claude Code (`CLAUDE.md`, `.claude/`). Both travel with Git and share one
project memory.

- Shared memory, plans and QA evidence live only in `.titan/memory/`,
  `.titan/plans/` and `.titan/qa/`. Upstream Claude paths (`.claude/memory/`,
  `.claude/PRPs/`) were rewritten to these; `.claude/memory/` must never exist.
- Claude skills and subagents use the `tf-` prefix, matching Codex names and
  avoiding a clash with the third-party `supabase` skill.
- Third-party skills stay in `.agents/skills/` (single copy, `skills-lock.json`);
  `.claude/skills/` holds thin bridge skills that point to them.
- `CLAUDE.md` imports `AGENTS.md` and is adapted to LensSpace (existing app, real
  stack, `docs/design/` precedence) instead of the generic factory prompt.
- Claude Code auto-memory is disabled in the versioned `.claude/settings.json`.
- `.mcp.json` is versioned without secrets. Local servers (`next-devtools`,
  `playwright`) start via `cmd /c npx` because native Windows Claude Code timed
  out spawning bare `npx`; macOS/Linux users override them with same-name
  local-scope servers.
- Updated 2026-10-01 (supersedes the `SUPABASE_ACCESS_TOKEN` setup): `supabase` is
  the hosted HTTP MCP `https://mcp.supabase.com/mcp?project_ref=...` with OAuth
  browser login (`/mcp` → Authenticate in Claude Code, `codex mcp login supabase`
  in Codex). The npx server timed out at startup on Windows and required a
  personal access token in the environment. The Supabase CLI is authenticated
  separately with `supabase login` and linked with `supabase link`; the hosted MCP
  does not reuse the CLI token.
- `tf-update-tf` uses `.claude/skills/tf-update-tf/scripts/sync_titan_factory.py`
  to re-apply the adaptations; `tf-memory-manager`, `tf-primer`, `tf-eject-tf` and
  `tf-update-tf` are hand-adapted and protected. `tf-eject-tf` never removes
  `.titan/` or the Codex toolbox.

Synced upstream: Titan Factory (Claude Code) commit `1d92ede`.

## Evidence

- `CLAUDE.md`, `AGENTS.md` (shared block), `.claude/`, `.mcp.json`, `.gitignore`
- `.claude/titan-factory-source.json`
- `docs/AGENT_SETUP.md`

Source: explicit user request to add the Claude Code Titan Factory alongside the
Codex version, share memory and keep everything in the repository; user chose the
`tf-` prefix and a LensSpace-adapted `CLAUDE.md`; on 2026-10-01 the user replaced
the environment-variable token with Supabase login (hosted MCP OAuth + CLI login).
