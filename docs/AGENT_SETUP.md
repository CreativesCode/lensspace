# AI agent setup (Codex + Claude Code)

LensSpace keeps the shared AI-agent context in the repository so every contributor
starts with the same instructions, workflows and project memory, whether they use
Codex, Claude Code or both.

## What is versioned

### Shared by both agents

- `AGENTS.md`: project-wide instructions and Next.js guidance. Claude Code imports it
  from `CLAUDE.md`.
- `.titan/memory/`: the single project memory (decisions, feedback, references).
- `.titan/plans/`: feature plans (PRPs). `.titan/qa/`: QA evidence.
- `.agents/skills/` + `skills-lock.json`: third-party project skills (Supabase,
  Supabase Postgres best practices, logo design).

### Codex

- `plugins/titan-factory-codex/`: the Titan Factory Codex plugin (29 `tf-` skills,
  scripts, references and templates).
- `.agents/plugins/marketplace.json`: the repo marketplace that exposes the plugin.
- `.codex/config.toml`: enables the repo plugin once the project is trusted.
- `.codex/agents/`: the seven `tf-` roles.

### Claude Code

- `CLAUDE.md`: imports `AGENTS.md` and adds the Claude-specific Titan Factory rules.
- `.claude/skills/tf-*`: the 29 Titan Factory skills (same names as Codex).
- `.claude/skills/{supabase,supabase-postgres-best-practices,logo-design}`: thin bridges
  that point Claude Code to the real skills in `.agents/skills/` (no duplication).
- `.claude/agents/tf-*.md`: the seven subagents (used only with user permission).
- `.claude/design-systems/`: optional design-system references.
- `.claude/settings.json`: disables Claude Code auto-memory so memory lives in `.titan/`.
- `.claude/titan-factory-source.json`: upstream commit and hashes of the synced toolbox.
- `.mcp.json`: project MCP servers (`supabase`, `next-devtools`, `playwright`) with
  `${ENV_VAR}` placeholders only.

### Never versioned

OAuth tokens, Supabase access tokens, API keys, `.env.local`, `.claude/settings.local.json`,
`CLAUDE.local.md`, plugin caches and personal agent settings stay on each machine.

## First use with Codex

1. Clone the repository and open its root as a trusted project in Codex.
2. Restart Codex after the clone so it discovers the project skills and the repo
   marketplace.
3. If the Titan Factory plugin is not visible, register the repo marketplace:

   ```powershell
   codex plugin marketplace add .
   ```

4. Install the plugin from that marketplace if Codex has not restored it automatically:

   ```powershell
   codex plugin add titan-factory-codex@lensspace
   ```

5. Add the hosted Supabase MCP server to your Codex installation and log in through
   the browser (OAuth, no personal access token):

   ```powershell
   codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=mgrqkbwgkkbshhtdpibs"
   codex mcp login supabase
   ```

   MCP OAuth sessions and tokens are intentionally not committed.

## First use with Claude Code

1. Clone the repository and open its root in Claude Code. `CLAUDE.md`, the skills,
   subagents and `.claude/settings.json` load automatically.
2. Approve the project MCP servers from `.mcp.json` when asked. The `supabase` server is
   Supabase's hosted MCP (`https://mcp.supabase.com/mcp`), scoped to the LensSpace
   project. It authenticates with your Supabase account through OAuth, so no personal
   access token or environment variable is needed:

   - Run `/mcp`, select `supabase` and choose **Authenticate**.
   - Log in to Supabase in the browser and authorize the organization that owns
     LensSpace.
   - Back in Claude Code, `/mcp` should show `supabase` as connected.

   The session is stored by Claude Code on your machine and never in the repository.
   `SUPABASE_PROJECT_REF` is optional and only needed to point at another project.
3. Log in to the Supabase CLI once per machine and link the repository. The CLI is used
   for `supabase db push`, `supabase migration list` and `supabase gen types --linked`:

   ```powershell
   scoop install supabase   # or: npm i -g supabase / brew install supabase/tap/supabase
   supabase login           # opens the browser; the token stays in the OS credential store
   supabase link --project-ref mgrqkbwgkkbshhtdpibs
   ```

   The CLI login and the MCP login are independent: each tool keeps its own session.

   The local servers in `.mcp.json` launch through `cmd /c npx` because native Windows
   cannot spawn `npx` directly. On macOS/Linux, override them with local-scope entries of
   the same name (local scope takes precedence over the project file):

   ```bash
   claude mcp add --scope local playwright -- npx @playwright/mcp@latest
   claude mcp add --scope local next-devtools -- npx -y next-devtools-mcp@latest
   ```

   The hosted `supabase` server needs no override.
4. Run `/tf-primer` to load project context and the shared memory.

## Common steps

1. Configure `.env.local` from `.env.local.example` with your own values.
2. Verify the project skills: `npx skills list`.
3. If a third-party skill directory is missing, restore the locked skills:
   `npx skills experimental_install`.

## Updating the toolboxes

- **Third-party skills** (shared): `npx skills update --project --yes`, then review the diff,
  especially third-party scripts and assets. The Claude bridges need no change.
- **Titan Factory Codex**: use the plugin's own lifecycle scripts
  (`plugins/titan-factory-codex/scripts/titan.py`).
- **Titan Factory Claude Code**: ask Claude for `/tf-update-tf`, or run the sync script with
  the path to your local `titan-factory` repository:

  ```powershell
  python .claude/skills/tf-update-tf/scripts/sync_titan_factory.py --source "<path>\titan-factory"
  python .claude/skills/tf-update-tf/scripts/sync_titan_factory.py --source "<path>\titan-factory" --apply
  ```

  It previews by default, re-applies the `tf-` prefix and the `.titan/` memory paths, never
  deletes project-only skills, never overwrites hand-adapted skills (`tf-memory-manager`,
  `tf-primer`, `tf-eject-tf`, `tf-update-tf`) and never touches `.titan/`.

Neither update path may remove or rewrite `.titan/memory/`.
