# Defensive JS Patterns

## Overview

Frontend JS in auth, dashboard, and admin shares defensive coding patterns that prevent silent failures when:
- HTML and JS versions are out of sync (stale deployments)
- DOM isn't ready when a script runs
- Expected elements are missing from the HTML

---

## Defensive `$` Helper

Used in `auth/js/app.js`, `dashboard/js/app.js`, and `admin/js/app.js`. The standard pattern:

```js
const $ = (id) => {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
    console.error('DOM not available')
    return null
  }
  const e = document.getElementById(id)
  if (!e) console.warn('Missing #' + id)
  return e
}
```

**Why:**
- **DOM check** — prevents `ReferenceError` if the script runs in a non-browser context (SSR, test, etc.)
- **Missing-element warning** — surfaces silent bugs early (e.g., HTML/JS version mismatch). In production, a stale deploy can ship new JS that expects elements not yet in the HTML — the warning makes this visible instead of crashing the whole script when `.addEventListener()` is called on `null`.

**When adding new event listeners or DOM manipulation, ALWAYS guard with null check:**

```js
const btn = $('btn-save')
if (btn) btn.addEventListener('click', handler)
// OR use optional chaining:
$('btn-save')?.addEventListener('click', handler)
```

This is mandatory for top-level handlers (e.g., `$('btn-logout')?.addEventListener(...)`) because their absence crashes the entire script before later handlers can register.

---

## Feather Icons Init

Every frontend JS file starts with:

```js
if (typeof feather !== 'undefined') feather.replace()
```

**Why:** The Feather Icons CDN script (`<script src="https://unpkg.com/feather-icons@4.29.2/dist/feather.min.js"></script>`) is loaded in the HTML but may not be ready when the IIFE runs. The `typeof` check prevents a `ReferenceError`.

Call `feather.replace()` once at startup to render all `<i data-feather="...">` icons in the DOM. Call it again after injecting new HTML that contains icons.

---

## IIFE Wrapper

All frontend JS files wrap their content in `(function() { ... })()` to avoid polluting the global namespace. This is required for `let`/`const` declarations to be locally scoped.

```js
(function() {
  if (typeof feather !== 'undefined') feather.replace()
  const $ = (id) => { /* ... */ }
  // ... rest of the app
})()
```

---

## Why These Patterns Exist

**The auth login crash (2026-06-04):** Production HTML was a simple login-only form (no tabs/registration), but the deployed JS expected tab elements (`$('tab-login')`, `$('reg-store')`). The script crashed at `null.addEventListener()` before the login handler registered, causing silent login failure with no error feedback.

The defensive `$` helper + null guards on top-level handlers prevent this class of bug from crashing the whole script.
