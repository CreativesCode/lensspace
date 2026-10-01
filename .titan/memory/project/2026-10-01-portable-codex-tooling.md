# Portable Codex tooling

Date: 2026-10-01

## Decision

LensSpace versions its shared Codex instructions, roles, Titan Factory plugin,
project skills and skill lockfile in the repository so every contributor receives
the same project workflows after cloning.

The Titan Factory Codex 0.1.0 plugin is distributed through the repo marketplace
named `lensspace`. The project also carries the Supabase, Supabase Postgres best
practices and logo-design skills under `.agents/skills/`.

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
- `docs/CODEX_SETUP.md`

Source: explicit user request to make the Codex project setup portable for the
team and to add `kaankiziltug/logo-design-skill`.
