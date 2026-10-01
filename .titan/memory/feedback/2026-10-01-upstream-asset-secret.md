# Upstream Titan Factory asset carried an OpenRouter key

Date: 2026-10-01

## What happened

GitHub push protection rejected `main` because
`.claude/skills/tf-video-visuals/assets/levy.png`, copied from the Titan Factory
(Claude Code) template, contained a real `OPENROUTER_API_KEY` inside its XMP
metadata (`iTXt` chunk, `dc:title`). The pixels were not involved.

## Rule

- After any `tf-update-tf` sync, scan new or changed binary assets before
  committing, e.g. `grep -alE 'sk-or-v1-[A-Za-z0-9]{20}|sbp_|sb_secret_' <files>`.
- Fix by stripping ancillary PNG chunks (keep only `IHDR`, `PLTE`, `IDAT`,
  `IEND`, `pHYs`) and amend the unpushed commit; never use the GitHub
  "allow secret" bypass.
- The key is exposed upstream and must be revoked by its owner in OpenRouter.

## Evidence

- Local commit `460d1fd` rewritten as `3ed3cd6` with the stripped image.
