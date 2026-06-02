# Typography

## Font Stacks

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
```

## Type Scale

| Token | Size | Usage |
|---|---|---|
| `--text-xs` | 0.75rem (12px) | Labels, captions, timestamps, metatext |
| `--text-sm` | 0.8125rem (13px) | Body text, table cells, buttons |
| `--text-base` | 0.875rem (14px) | Primary body text size |
| `--text-lg` | 1rem (16px) | Card titles, section headings |
| `--text-xl` | 1.25rem (20px) | Page subheadings |
| `--text-2xl` | 1.5rem (24px) | Page titles (h2) |
| `--text-3xl` | 2rem (32px) | Stat numbers, hero text |

## Line Height

| Token | Value |
|---|---|
| `--leading-tight` | 1.25 |
| `--leading-normal` | 1.5 |
| `--leading-relaxed` | 1.625 |

## Letter Spacing

| Token | Value |
|---|---|
| `--tracking-tight` | -0.025em |
| `--tracking-normal` | 0 |
| `--tracking-wide` | 0.05em |

## Usage Guidelines

| Element | Size | Weight | Spacing | Other |
|---|---|---|---|---|
| Page title (h2) | `--text-2xl` | 700 | `--tracking-tight` | `--leading-tight` |
| Card title | `--text-lg` | 600 | — | — |
| Body text | `--text-base` / `--text-sm` | 400 | — | `--leading-normal` |
| Labels / captions | `--text-xs` | 600 | `--tracking-wide` | Uppercase, `--text-tertiary` |
| Code / barcodes | `--text-sm` | 400 | `--tracking-wide` | `--font-mono` |
| Stat numbers | `--text-3xl` / `--text-2xl` | 800 | `--tracking-tight` | — |
| Buttons | `--text-sm` | 600 | — | — |

## Inter Font Loading

Loaded via Google Fonts in every HTML page. Add before other CSS:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```
