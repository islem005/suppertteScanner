# Layout & Component Patterns

## Spacing Scale

| Token | Value |
|---|---|
| `--space-1` | 0.25rem (4px) |
| `--space-2` | 0.5rem (8px) |
| `--space-3` | 0.75rem (12px) |
| `--space-4` | 1rem (16px) |
| `--space-5` | 1.25rem (20px) |
| `--space-6` | 1.5rem (24px) |
| `--space-8` | 2rem (32px) |
| `--space-10` | 2.5rem (40px) |
| `--space-12` | 3rem (48px) |

## Border Radius

| Token | Value | Used on |
|---|---|---|
| `--radius-sm` | 0.25rem (4px) | Badges, tags, offer thumbnails |
| `--radius-md` | 0.5rem (8px) | Buttons, inputs, icon buttons |
| `--radius-lg` | 0.75rem (12px) | Cards, panels, table wraps |
| `--radius-xl` | 1rem (16px) | Modals |
| `--radius-full` | 9999px | Avatars, pill badges |

## Shadows

| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` |
| `--shadow-lg` | `0 8px 30px rgba(0,0,0,0.5)` |
| `--shadow-glow-primary` | `0 0 16px rgba(99,102,241,0.3)` |

## Transitions

| Token | Value | Usage |
|---|---|---|
| `--transition-fast` | 150ms ease | Button hover, icon toggles |
| `--transition-base` | 200ms ease | Modal open/close, sidebar slide |
| `--transition-slow` | 300ms cubic-bezier(0.32,0.72,0,1) | Page transitions, panel slides |

## Component Patterns

### Buttons

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  line-height: 1;
  transition: background var(--transition-fast), transform var(--transition-fast);
}
.btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.btn:active { transform: scale(0.97); }

.btn-primary   { background: var(--color-primary); color: var(--color-primary-text); }
.btn-primary:hover { background: var(--color-primary-hover); }
.btn-secondary { background: var(--bg-hover); color: var(--text-primary); }
.btn-secondary:hover { background: var(--bg-elevated); }
.btn-ghost     { background: transparent; color: var(--text-secondary); }
.btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn-danger    { background: var(--color-danger-muted); color: var(--color-danger); }
.btn-danger:hover { background: rgba(244, 63, 94, 0.25); }
.btn-sm { padding: var(--space-1) var(--space-3); font-size: var(--text-xs); }
.btn-small { /* alias used in inline HTML */ padding: var(--space-1) var(--space-3); font-size: var(--text-xs); }
```

### Form Inputs

```css
.form-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-inset);
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.form-input::placeholder { color: var(--text-disabled); }
.form-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-muted);
}
.form-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  margin-bottom: var(--space-1);
}
```

### Cards

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.card-elevated {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
```

### Tables

```css
.table-wrap {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
thead { position: sticky; top: 0; z-index: 1; }
th {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
}
td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
}
tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: var(--bg-hover); }
```

### Modals

```css
#modal-overlay {
  position: fixed; inset: 0;
  background: var(--overlay-dark);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
  animation: fadeIn 150ms ease;
}
#modal-overlay.hidden { display: none; }
#modal-box {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  min-width: 360px;
  max-width: 480px;
  box-shadow: var(--shadow-lg);
  animation: scaleIn 200ms ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.modal-actions { display: flex; gap: var(--space-2); justify-content: flex-end; margin-top: var(--space-4); }
```

### Toast / Notifications

```css
#toast {
  position: fixed;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: 500;
  opacity: 0;
  pointer-events: none;
  z-index: 100;
  transition: opacity var(--transition-base), transform var(--transition-base);
  white-space: nowrap;
  box-shadow: var(--shadow-md);
}
#toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
```

### Icon Buttons

```css
.icon-btn {
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  background: var(--bg-hover);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.icon-btn:hover { background: var(--bg-elevated); color: var(--text-primary); }
.icon-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.icon-btn:active { transform: scale(0.95); }
.icon-btn.active { color: var(--color-primary); background: var(--color-primary-muted); }
```

### Stat Cards

```css
.stat-card {
  text-align: center;
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.stat-card .num {
  display: block;
  font-size: var(--text-3xl);
  font-weight: 800;
  letter-spacing: var(--tracking-tight);
  color: var(--text-primary);
}
.stat-card .label {
  display: block;
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-tertiary);
  margin-top: var(--space-1);
}
```

### Empty State

```css
.empty-state {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}
```

### Barcode Tag

```css
.barcode-tag, .meta {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  letter-spacing: var(--tracking-wide);
}
```

## Accessibility

- Every `icon-btn` must have an `aria-label`
- Every form input must have an associated `<label>` or `aria-label`
- `:focus-visible` must be defined for `button`, `input`, `select`, `textarea`, `a`
- Color contrast must meet WCAG AA: text on `--bg-surface` must be at least `--text-secondary`
- Support `prefers-reduced-motion`: wrap animations in `@media (prefers-reduced-motion: no-preference)`
