# Code-Lore Management

## How Lore Grows

Lore grows organically from real work. During regular tasks, the agent watches for repeatable patterns that should be documented.

### Flagging Process

1. **Notice** — Agent spots a pattern mid-task (e.g., consistent error format, file naming convention, CSS approach)
2. **Pin** — Note the observation without interrupting the current work
3. **Ask** — At a natural stopping point (or at handoff), mention: *"I noticed [pattern]. Should I document this in code-lore?"*
4. **Plan** — If user agrees, outline what the lore file will contain
5. **Create** — Write the lore file, add it to `code-lore-index.md`, continue work

### When to Add Lore

Any pattern that would be useful to remember next time:
- Color choices, spacing, typography (→ `styles/`)
- Component patterns, DOM structure (→ `components/`)
- Error handling, API calls, data flow (→ `patterns/`)
- Auth, environment config, secrets (→ `security/`)
- Workflow, conventions, project rules (→ `project-management/`)

### When NOT to Add Lore

- One-off implementations unlikely to repeat
- External library documentation (link to docs instead)
- Things already covered by existing lore files (check the index first)

## Adding a New Lore File

1. Choose the right category directory under `code-lore/`
2. Write a focused markdown file with clear headings
3. Add an entry to `code-lore/code-lore-index.md` under the appropriate category
4. Keep files concise — reference existing lore when possible instead of duplicating

## Structure Rules

- Use `# Title` for the file title
- Use `## Section` for major sections
- Use `### Subsection` for details
- Use code blocks with language tags for any code examples
- Use tables for structured data (token mappings, command lists)
