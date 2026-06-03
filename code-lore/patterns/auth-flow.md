# Auth Flow

## Overview

Shelf Scanner uses Better Auth cookie-based authentication across all apps. Sessions are stored in httpOnly cookies and validated server-side.

---

## Login Page (`auth/index.html`, `auth/js/app.js`)

The shared login page at `/auth/` handles all non-admin authentication.

### Flow
1. **API health check** on load — `GET /api/health` to verify backend is reachable. Shows a warning banner if unreachable.
2. User submits email + password to `POST /api/auth/sign-in/email`
3. On success:
   - Stores user object in `localStorage.setItem('user', ...)`
   - Redirects to `/dashboard/`
4. On error:
   - Shows error message in `#login-error`
   - Re-enables submit button

### Credentials
Test credentials (used in local dev + CI/CD):
| Role | Email | Password |
|---|---|---|
| Admin | `admin@store.com` | `admin123` |
| Manager | `manager@store.com` | `manager123` |

---

## Dashboard Auth (`dashboard/js/app.js`)

### Init Flow
1. Load user from `localStorage.getItem('user')`
2. Verify session via `GET /api/auth/user` with `credentials: 'include'`
3. If valid: load store data, route to dashboard
4. If invalid: redirect to `/auth/`

### Session Persistence
- User object cached in `localStorage` key `user`
- Session token in httpOnly cookie (managed by Better Auth)
- On 401 from any API call: auto-redirect to `/auth/`

### Logout
- `POST /api/auth/sign-out`
- Remove `localStorage` user
- Redirect to `/auth/`

---

## Admin Auth (`admin/js/app.js`)

### Init Flow
1. Load user from `localStorage.getItem('user')`
2. Verify session via `GET /api/auth/user`
3. Check `user.role === 'admin'` — if not, show login view
4. Load stores, route to dashboard

### Admin Login Form
- Inline login form on the admin page (not redirect to `/auth/`)
- Posts to `POST /api/auth/sign-in/email`
- Validates role — non-admin users see: "This login is for admin accounts only"
- On success: load stores, route to dashboard, show welcome toast

### Logout
- `POST /api/auth/sign-out`
- Clear localStorage user
- Show login view (not redirect)

---

## Cloudflare Access Auth (`admin.ivond.com`)

- Admin subdomain is behind Cloudflare Access (Email OTP)
- Pages Function routes `admin.ivond.com/` → redirect to `/admin/`
- HTML contains `<meta name="cf-access">` tag
- Auth exchange: `POST /api/auth/cf-access` with `Cf-Access-Authenticated-User-Email` header
- Separate `admin-auth` D1 database for authorized admin emails
- Cloudflare Access enforces at network level before requests reach Pages

---

## Cross-Subdomain Auth

See `security/protocols.md` for technical details on:
- `sameSite: 'none'` + `secure: true` cookie config
- Dynamic trusted origins via `isTrustedOrigin()`
- Per-request `createAuth(env, requestOrigin)` calls

## localStorage Keys

| Key | Purpose | Cleared on |
|---|---|---|
| `user` | Cached user JSON (id, email, role, display_name, store_id) | 401, logout |
| `api_base` | Optional API URL override for testing | — |
| `lang` | Language preference (en/fr) | — |
