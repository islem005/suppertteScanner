# Thread Handoff Protocol v1.0

## When to Hand Off

When the user says **"Let's prepare for the next thread"** or any equivalent phrase signaling end of session.

## Steps

1. **Read current handoff** — Read `project_handoffs/latest_handoff.md` to know current version
2. **Archive current session** — Copy `project_handoffs/latest_handoff.md` into `project_handoffs/v{N}/` with filename `handoff-{N}.md`
3. **Read version counter** — Read `project_handoffs/version.txt`
4. **Increment** — Increment the number in `version.txt`
5. **Create fresh handoff** — Write new `project_handoffs/latest_handoff.md` with:
   - New version number
   - Current date
   - Summary of what was accomplished this session
   - Recent changes (bulleted)
   - Next tasks (prioritized list)
   - Any flags for lore (patterns noticed during the session)

## Handoff File Template

```markdown
# Handoff v{N} — {Date}

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
2. Read `project_handoffs/latest_handoff.md` for current status
3. Read `code-lore/code-lore-index.md` for lore overview
4. If something needed isn't documented, stop and ask
