# Shelf Scanner — UI Design System & Conventions

## 0. Rules for AI Agents

**You MUST read and follow this file before making any UI changes.** If you are unsure whether a change is UI-related, err on the side of reading this file.

- **After every significant codebase change** (new features, refactors, bug fixes, dependency updates), invoke the `@tester` subagent to run tests and verify nothing is broken.
- **Never** use emoji characters as icons (📊, ⚙, 📷, 💡, ☰, ✕, ⬇, etc.). Use Feather Icons instead.
- **Never** use hardcoded color values outside the palette defined in §1. Always use CSS custom properties.
- **Never** add inline styles in JavaScript. Use CSS classes.
- **Never** introduce new border-radius, box-shadow, font-size, or spacing values outside the token system.
- **Always** add `:focus-visible` outlines on interactive elements.
- **Always** support `prefers-reduced-motion`.

---

## 1. Color Palette

Use CSS custom properties exclusively. No hardcoded hex values except when defining these tokens.

```css
:root {
  /* Backgrounds — warm dark slate */
  --bg-base:    #0c0c0d;
  --bg-surface: #18181b;
  --bg-elevated:#1f1f23;
  --bg-hover:   #27272a;
  --bg-inset:   #101012;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-strong:  rgba(255, 255, 255, 0.15);

  /* Text */
  --text-primary:    #fafafa;
  --text-secondary:  #a1a1aa;
  --text-tertiary:   #71717a;
  --text-disabled:   #52525b;

  /* Brand */
  --color-primary:     #6366f1;
  --color-primary-hover:  #818cf8;
  --color-primary-muted:  rgba(99, 102, 241, 0.15);
  --color-primary-text:   #ffffff;

  /* Semantic */
  --color-success:       #10b981;
  --color-success-muted: rgba(16, 185, 129, 0.15);
  --color-warning:       #f59e0b;
  --color-warning-muted: rgba(245, 158, 11, 0.15);
  --color-danger:        #f43f5e;
  --color-danger-muted:  rgba(244, 63, 94, 0.15);

  /* Overlay */
  --overlay-dark: rgba(0, 0, 0, 0.7);
  --overlay-light: rgba(0, 0, 0, 0.4);
}
```

---

## 2. Typography

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;

  --text-xs:   0.75rem;   /* 12px */
  --text-sm:   0.8125rem; /* 13px */
  --text-base: 0.875rem;  /* 14px */
  --text-lg:   1rem;      /* 16px */
  --text-xl:   1.25rem;   /* 20px */
  --text-2xl:  1.5rem;    /* 24px */
  --text-3xl:  2rem;      /* 32px */

  --leading-tight:   1.25;
  --leading-normal:  1.5;
  --leading-relaxed: 1.625;

  --tracking-tight:  -0.025em;
  --tracking-normal: 0;
  --tracking-wide:   0.05em;
}
```

### Usage guidelines
| Element | Token | Notes |
|---|---|---|
| Page title (h2) | `--text-2xl` / `--text-xl` | `--leading-tight`, `--tracking-tight` |
| Card title | `--text-lg` / `--text-base` | Font weight 600 |
| Body text | `--text-base` / `--text-sm` | `--leading-normal` |
| Labels / captions | `--text-xs` | Uppercase, `--tracking-wide`, `--text-tertiary` |
| Code / barcodes | `--font-mono` | `--text-sm`, `--tracking-wide` |
| Stat numbers | `--text-3xl` / `--text-2xl` | Font weight 800, `--tracking-tight` |

---

## 3. Spacing Scale

```css
:root {
  --space-1:  0.25rem;  /* 4px */
  --space-2:  0.5rem;   /* 8px */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-5:  1.25rem;  /* 20px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
}
```

---

## 4. Border Radius

```css
:root {
  --radius-sm: 0.25rem;  /* 4px */
  --radius-md: 0.5rem;   /* 8px */
  --radius-lg: 0.75rem;  /* 12px */
  --radius-xl: 1rem;     /* 16px */
  --radius-full: 9999px;
}
```

| Element | Token |
|---|---|
| Buttons | `--radius-md` |
| Cards / panels | `--radius-lg` |
| Modals | `--radius-xl` |
| Inputs | `--radius-md` |
| Badges / tags | `--radius-sm` |
| Icon buttons | `--radius-md` (NOT circles unless avatar) |

---

## 5. Shadows

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.5);
  --shadow-glow-primary: 0 0 16px rgba(99, 102, 241, 0.3);
}
```

---

## 6. Transitions

```css
:root {
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
```

---

## 7. Feather Icons

Load from CDN in every HTML page:
```html
<script src="https://unpkg.com/feather-icons@4.29.2/dist/feather.min.js"></script>
```

After DOM content loaded, call `feather.replace()` to render icons.

### Icon usage
```html
<!-- Before (WRONG) -->
<button id="btn-torch" class="icon-btn" aria-label="Toggle flash">💡</button>

<!-- After (CORRECT) -->
<button id="btn-torch" class="icon-btn" aria-label="Toggle flash">
  <i data-feather="zap"></i>
</button>
```

### Common icon mapping
| Purpose | Feather icon name |
|---|---|
| Hamburger menu | `menu` |
| Close / dismiss | `x` |
| Flashlight / torch | `zap` |
| Download / export | `download` |
| Delete / remove | `trash-2` |
| Clear all | `x-circle` |
| Plus / add | `plus` |
| Minus / subtract | `minus` |
| Dashboard / overview | `bar-chart-2` |
| Admin / settings | `settings` |
| Camera / scan | `camera` |
| Store / building | `home` |
| Products | `package` |
| Users | `users` |
| Branding / palette | `palette` |
| Activity / clock | `clock` |
| Profile / user | `user` |
| Sign out | `log-out` |
| Search | `search` |
| Check / confirm | `check` |
| Alert / warning | `alert-triangle` |
| Upload | `upload` |
| Link / external | `external-link` |

### Icon button sizing
```css
.icon-btn {
  width: 2.5rem;    /* 40px */
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

---

## 8. Component Patterns

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
  transition: background var(--transition-fast), transform var(--transition-fast);
  line-height: 1;
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

---

## 9. Scanner Page — Specific Conventions

### Scan Frame
Use 4 corner brackets instead of a full border rectangle:
```css
#scan-frame {
  position: relative;
  width: min(280px, 70vw);
  height: min(120px, 30vw);
}
#scan-frame::before,
#scan-frame::after {
  content: '';
  position: absolute;
  width: 24px; height: 24px;
  border-color: var(--color-primary);
  border-style: solid;
}
#scan-frame::before {
  top: 0; left: 0;
  border-width: 2px 0 0 2px;
  border-radius: 4px 0 0 0;
}
/* ... etc for each corner */
```

### Scan Line
```css
#scan-line {
  position: absolute;
  top: 0; left: 8px; right: 8px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
  animation: scan 2s ease-in-out infinite;
}
@keyframes scan {
  0%, 100% { top: 0; }
  50% { top: calc(100% - 1px); }
}
```

### Results Panel
Slide-up panel with a drag handle visual at top. Items show barcode (monospace), product name if available, quantity controls, and delete button (Feather icons).

### Result Overlay
Slide-up card at bottom of scanner view, positioned above controls. Green border + background tint for found, red for not-found.

---

## 10. Dashboard / Admin — Layout Conventions

### Sidebar
- Width: 220px (collapsible on narrow screens via media query)
- Active nav item: left border accent (`2px solid var(--color-primary)`) instead of background fill
- Nav items use Feather icons (16px) + label (14px)
- User section at bottom with avatar circle, name, sign-out button

### Login Card
- Centered vertically + horizontally
- Max-width: 380px
- Subtle border + shadow
- No emoji logo — use a clean icon or plain text

---

## 11. Accessibility Rules

- Every `icon-btn` must have an `aria-label`
- Every form input must have an associated `<label>` or `aria-label`
- `:focus-visible` must be defined for `button`, `input`, `select`, `textarea`, `a`
- Color contrast must meet WCAG AA: text on `--bg-surface` must be at least `--text-secondary`
- Support `prefers-reduced-motion`: wrap animations in `@media (prefers-reduced-motion: no-preference)`

---

## 12. Shared JS Utilities (`js/shared.js`)

Extract these functions into a single shared file to avoid duplication across dashboard and admin:

```js
const UI = (() => {
  return {
    toast(msg, duration = 2000) { /* ... */ },
    escapeHtml(str) { /* ... */ },
    showModal(title, body, onConfirm, danger) { /* ... */ },
    closeModal() { /* ... */ },
    $(id) { /* return document.getElementById(id) */ },
  };
})();
```

---

## 13. Implementation Phases

### Phase A — Foundation
- [ ] Create `css/tokens.css` with all CSS custom properties
- [ ] Create `js/shared.js` with shared utilities
- [ ] Add Inter font + Feather Icons CDN to all 3 HTML pages
- [ ] Replace emojis with Feather icons in all HTML and JS files

### Phase B — Scanner Page
- [ ] Rewrite `css/style.css` using design tokens
- [ ] Corner-bracket scan frame
- [ ] Refined scan line animation
- [ ] Better result overlay (slide-up card)
- [ ] Polished results panel with Feather icons
- [ ] Improved top bar and bottom controls

### Phase C — Dashboard & Admin
- [ ] Rewrite `dashboard/css/style.css` and `admin/css/style.css` using tokens
- [ ] Refined sidebar with active left-border indicator
- [ ] Better stats cards with icons
- [ ] Polished tables, forms, buttons, modals
- [ ] Timeline-style activity feed
- [ ] Remove all inline styles from JS

### Phase D — Polish
- [ ] View transition animations
- [ ] Focus-visible on all elements
- [ ] Reduced motion support
- [ ] Responsive sidebar collapse
- [ ] Loading skeletons for dashboard data
