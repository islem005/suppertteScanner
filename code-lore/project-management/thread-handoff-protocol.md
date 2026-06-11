# Thread Handoff Protocol v1.0

## When to Hand Off

When the user says **"Let's prepare for the next thread"** or any equivalent phrase signaling end of session.

## Mini Handoff (Auto-Compact)

When context limits are approached and a compact is necessary, do NOT skip the handoff. Run a **mini handoff** first:

1. **Flush lore flags** — Note any patterns noticed this session. Ask the user if they should be documented. If yes, update lore.
2. **Write state snapshot** — Prepend a compact note to the conversation (or write to a scratch file) with:
   - What was accomplished so far
   - What's in progress / next
   - Any open questions or blockers
3. **Proceed with compact** — Once state is captured, the compact is safe.

This preserves continuity without a full archive cycle.

## Steps

1. **Update lore before compacting** — Ask the user about any flagged patterns. If they agree, create/update the lore file(s), then update `code-lore/code-lore-index.md`
2. **Read current handoff** — Read `project_handoffs/latest_handoff.md` to know current version
3. **Archive current session** — Copy `project_handoffs/latest_handoff.md` into `project_handoffs/v{N}/` with filename `handoff-{N}.md`
4. **Read version counter** — Read `project_handoffs/version.txt`
5. **Increment** — Increment the number in `version.txt`
6. **Create fresh handoff** — Write new `project_handoffs/latest_handoff.md` with:
   - New version number
   - Current date
   - Current branch name (e.g., `main` or `feature/xxx`)
   - Summary of what was accomplished this session
   - Recent changes (bulleted)
   - Next tasks (prioritized list)
   - Any flags for lore (patterns noticed during the session)

## Handoff File Template

```markdown
# Handoff v{N} — {Date}

## Branch
`main` or `feature/xxx` (if in progress)

## Summary
{one-paragraph summary of what happened this session}

## Recent Changes
- {change 1}
- {change 2}

## Next Tasks
1. {highest priority task}
2. {next task}
3. {next task}

## Lore Flags
- {anything noticed that should be in code-lore, if any}
```

## Lore Flags

During a session, the agent may notice patterns worth documenting. Pin these without interrupting work. At handoff time, present them:

> "I noticed [pattern]. Should I document this in code-lore?"

If user agrees, plan the lore file first, then create it, add to the index, and continue.

## Starting a New Session

When user returns and says things like "Please read the latest handoff" or "Let's dive into phase 3":

1. Read `AGENTS.md` for project orientation
2. **Read the handoff first** — Read `project_handoffs/latest_handoff.md` for current status
3. **Then read code-lore** — Read `code-lore/code-lore-index.md` for permanent patterns & conventions
4. **Check git branch** — Run `git branch --show-current`. If handoff records an open `## Branch`, continue on it. If starting fresh work, create `feature/<name>` from `main`.
5. If something needed isn't documented, stop and ask
