# Portable Codex tooling

Date: 2026-10-01

## Decision

LensSpace versions its shared Codex instructions, roles, Titan Factory plugin,
project skills and skill lockfile in the repository so every contributor receives
the same project workflows after cloning.

The Titan Factory Codex 0.1.0 plugin is distributed through the repo marketplace
named `lensspace`. The project also carries the Supabase, Supabase Postgres best
practices and logo-design skills under `.agents/skills/`.

Extended the same day to Claude Code; see
[Dual-agent tooling](2026-10-01-dual-agent-tooling.md).

## Boundary

Credentials and personal state do not travel with Git. Each contributor must
configure their own environment file and authenticate their own Supabase MCP
connection. Plugin caches, OAuth tokens and user-level Codex settings remain
outside the repository.

## Evidence

- `.agents/plugins/marketplace.json`
- `.codex/config.toml`
- `plugins/titan-factory-codex/`
- `.agents/skills/logo-design/`
- `skills-lock.json`
- `docs/AGENT_SETUP.md` (renamed from `docs/CODEX_SETUP.md` on 2026-10-01)

Source: explicit user request to make the Codex project setup portable for the
team and to add `kaankiziltug/logo-design-skill`.
