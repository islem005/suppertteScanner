# UI Review — SKANER by ivond

Date: 2026-06-11
Reviewer: AI UI Specialist

## Overall

The UI is built on a solid design token system with a well-executed dark theme,
consistent typography, and good RTL/i18n support. The branding phone mockup,
responsive table cards, and landing page are highlights. Issues center on
accessibility gaps, JS/CSS duplication, hardcoded colors in template strings,
and admin panel lacking i18n and responsive tables.

---

## ✅ Strengths

- **Design System**: Comprehensive CSS custom properties in `css/tokens.css`
  (colors, spacing, radius, shadows, transitions). Used consistently across
  all pages.
- **Dark Theme**: Warm slate palette (`--bg-base: #0c0c0d`) with indigo
  primary (`#6366f1`) — modern, easy on the eyes.
- **Typography**: Inter font, well-proportioned scale (xs→3xl), proper loading
  with preconnect.
- **Phone Mockup Preview**: CSS-only phone with corner-bracket scan frame,
  animated scan line, live brand color/logo/social preview. Detailed and
  functional.
- **Mobile Table Cards**: Dashboard converts tables to labeled card layout
  using `data-label` — excellent responsive pattern (dashboard CSS `@media
  (max-width: 768px)`).
- **RTL Support**: Direction-aware overrides for nav, sidebar, tables, forms,
  language selector, step arrows. Comprehensive.
- **Accessibility Basics**: `:focus-visible`, `prefers-reduced-motion`,
  `skip-link` in scanner, `aria-modal` on dialogs, `aria-live` on toasts.
- **i18n**: Dashboard and homepage use `I18N.t()` for all visible strings.
  Three languages (English, Français, العربية).

---

## Issues by Severity

### 🔴 HIGH

| # | Issue | File | Line(s) | Status |
|---|---|---|---|---|
| 1 | **`esc()` defined identically in two files, not in shared.js** — dashboard and admin each define their own HTML-escaping helper, while `window.escapeHtml` in `shared.js` is unused. If called before local def loads, throws ReferenceError. | `dashboard/js/app.js`, `admin/js/app.js`, `js/shared.js` | 1222, 1997, 1 | ✅ Fixed |
| 2 | **Duplicate `#toast` rules** — `tokens.css` and `css/style.css` both define `#toast` with different styles (blur backdrop vs solid, nowrap vs normal). Behavior differs per page. | `css/tokens.css`, `css/style.css` | 232, 352 | ✅ Fixed |
| 3 | **Hardcoded `#000` background** — Scanner `#app` uses raw black instead of CSS variable, breaks theme consistency. | `css/style.css` | 7 | ✅ Fixed |

### 🟡 MEDIUM

| # | Issue | File | Line(s) | Status |
|---|---|---|---|---|
| 4 | **Admin tables not responsive** — Dashboard uses card-conversion pattern; admin uses `overflow-x: auto` with `min-width: 500px`, forcing horizontal scroll on mobile. | `admin/css/style.css` | 190–191 | ✅ Fixed |
| 5 | **Hardcoded hex colors in JS template strings** — `renderTrendChart`, `renderDeviceChart`, and status indicators use raw hex (`#6366f1`, `#10b981`, `#00c875`, `#ffc107`, `#ff4444`) instead of CSS custom properties. | `dashboard/js/app.js`, `admin/js/app.js` | 318–330, 302–309, +inline styles | ✅ Fixed |
| 6 | **Admin panel is English-only** — No `data-i18n` or `I18N.t()`. Dashboard and homepage have full i18n; admin doesn't. | `admin/index.html`, `admin/js/app.js` | entire file | ⏸️ Deferred |
| 7 | **Color-only status indicators** — Active/featured use ✓/○/★ symbols with no text or `aria-label`. Code comments acknowledge this (`// a11y: color-only indicator`) but unfixed. | `dashboard/js/app.js` | 597, 742, 748 | ✅ Fixed |
| 8 | **No scroll reset on view switch** — Switching dash views doesn't scroll `#main-content` to top; user stays at previous scroll position. | `dashboard/js/app.js`, `admin/js/app.js` | `showDashView()` | ✅ Fixed |
| 9 | **Borderline contrast on small text** — `--text-tertiary: #71717a` on `--bg-base: #0c0d0d` yields ~4.5:1, just passing WCAG AA. At `--text-xs (12px)` this is acceptable but not comfortable. | `css/tokens.css` | 16, 4 | ❌ Not started |

### 🔵 LOW

| # | Issue | File | Line(s) | Status |
|---|---|---|---|---|
| 10 | **Camera feed fully grayscale** — `filter: grayscale(1)` makes live camera look dead. 30-50% would aid barcode detection without looking broken. | `css/style.css` | 137 | ✅ Fixed |
| 11 | **"SKANER by ivond" brand link at 0.5rem** — ~8px font is hard to read and tap. | `css/style.css` | 47 | ✅ Fixed |
| 12 | **`feather.replace()` called redundantly** — Called on load, after nav build, after branding form render. Should be called once at end of render cycle. | `dashboard/js/app.js` | 2, 90 | ✅ Fixed |
| 13 | **Duplicate CSS rule** — `.branding-form { max-width: 500px }` appears twice. | `admin/css/style.css` | 92, 396 | ✅ Fixed |
| 14 | **Import status colors hardcoded** — Use `#ffc107`, `#00c8ff`, `#00c875`, `#ff4444` instead of CSS variable mappings. | `admin/css/style.css` | 230–233 | ✅ Fixed |
| 15 | **`user-select: none` on body** — Prevents text selection site-wide. Should be scoped to interactive elements only. | `css/tokens.css` | 88 | ✅ Fixed |
| 16 | **`lang` attribute not updated on i18n switch** — `dir="rtl"` is set but `<html lang="...">` stays `"en"`, affecting screen readers. | `js/i18n.js` | — | ✅ Already fixed (setLang sets document.documentElement.lang) |

---

## Remaining Work

- **Issue #6** — Admin i18n (deferred — large task)
- **Issue #9** — Contrast fine-tuning (subjective, depends on design intent)
