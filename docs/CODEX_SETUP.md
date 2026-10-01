# Codex project setup

LensSpace keeps its shared Codex context in the repository so contributors start
with the same project instructions and reusable workflows.

## Included in Git

- `AGENTS.md`: project-wide instructions and Next.js guidance.
- `.codex/agents/`: the seven project roles used by Titan Factory.
- `.titan/`: durable decisions, plans and QA evidence.
- `.agents/skills/`: project skills for Supabase, Postgres and logo design.
- `skills-lock.json`: sources and integrity hashes for those project skills.
- `plugins/titan-factory-codex/`: the portable Titan Factory plugin, including
  its 29 skills, scripts, references and templates.
- `.agents/plugins/marketplace.json`: the repo marketplace that exposes Titan
  Factory to Codex.
- `.codex/config.toml`: project configuration that enables the repo plugin once
  the repository is trusted.

## First use on another machine

1. Clone the repository and open its root as a trusted project in Codex.
2. Restart Codex after the clone so it discovers the project skills and the
   repo marketplace.
3. If the Titan Factory plugin is not visible, register the repo marketplace:

   ```powershell
   codex plugin marketplace add .
   ```

4. Install the plugin from that marketplace if Codex has not restored it
   automatically:

   ```powershell
   codex plugin add titan-factory-codex@lensspace
   ```

5. Verify the project skills:

   ```powershell
   npx skills list
   ```

6. If a local skill directory is missing, restore the locked skills:

   ```powershell
   npx skills experimental_install
   ```

7. Configure `.env.local` from `.env.local.example` with the contributor's own
   environment values.
8. Add and authenticate the Supabase MCP connection in that contributor's Codex
   installation. MCP OAuth sessions and tokens are intentionally not committed.

The repository never carries OAuth tokens, Supabase secrets, API keys, personal
Codex settings or cached plugin installations. Those remain machine-specific.

## Updating shared skills

Use the project-scoped skills workflow so both `.agents/skills/` and
`skills-lock.json` remain synchronized:

```powershell
npx skills update --project --yes
```

Review the resulting diff before committing it, especially third-party scripts
and reference assets.
