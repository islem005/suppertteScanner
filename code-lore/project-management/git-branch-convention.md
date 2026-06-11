# Git Branch Convention

## Overview

Standard GitHub Flow: `main` is always deployable. Every non-trivial task gets a feature branch. Merge when done, delete the branch.

## Branch Naming

| Prefix | Use Case | Example |
|---|---|---|
| `feature/` | New features, API endpoints, UI pages, refactors | `feature/admin-i18n` |
| `fix/` | Bug fixes (single commit or small) | `fix/login-redirect` |
| `chore/` | Tooling, CI/CD, dependency updates | `chore/wrangler-upgrade` |

No other prefixes. No branch names without a prefix.

## Workflow

```
main (always deployable)
  └── feature/<short-description> (from main)
        └── work until complete
        └── merge to main (squash or fast-forward)
        └── delete branch
```

### Starting a Session

1. Read `project_handoffs/latest_handoff.md` for current status
2. Read `code-lore/code-lore-index.md` for permanent conventions
3. Run `git branch --show-current` to know where you are
4. If the work is non-trivial (not a single-file typo/doc fix):
   - Check if there's already an open feature branch from a previous session (handoff records it)
   - If yes — continue on that branch
   - If no — create `feature/<short-name>` from `main`

### Merging

- When feature is complete: `git checkout main && git merge feature/xxx && git branch -d feature/xxx`
- Push main: `git push`
- Squash merge preferred for single-session features to keep history clean
- Regular merge (preserve commits) OK for multi-session features

### Trivial Work (No Branch Needed)

- Single-file typo fixes (README, comments)
- Documentation-only changes
- If in doubt, create a branch.

## Session Continuity (Multi-Session Features)

If a feature spans multiple sessions:

1. First session creates `feature/xxx`, works, writes handoff with `## Branch: feature/xxx`
2. Next session reads handoff, sees the open branch, `git checkout feature/xxx`
3. Feature stays on that branch until merged to `main`

The handoff file is the source of truth for what branch the project is on.

## Lore and Branches

- Lore files document **permanent** patterns (post-merge knowledge)
- Branch-specific notes go in the handoff only
- Lore is never different per branch — if a pattern changes, update the lore file on `main` after merge

## History

This project was originally on `feature/r2-file-uploads` (a long-running catch-all branch).
On 2026-06-11 it was renamed to `main` via:
- `master` → `old-master` (local backup)
- `feature/r2-file-uploads` → `main`
- `migrate-d1-better-auth` was the GitHub default branch → changed to `main`
