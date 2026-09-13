# Continuous implementation memory

Date: 2026-09-13
Source: explicit user instruction during MVP implementation.

## Preference

Keep project memory updated as implementation progresses. Record completed
behavior, how it was implemented, consequential decisions and their rationale,
verification evidence, known limitations and the next work item.

Use `.titan/memory/` for durable context and `.titan/qa/` for detailed test
evidence. Never store credentials, secret values or unnecessary private data.
Memory records describe verified repository/project state; they do not imply that
changes were committed or deployed unless separately verified.
