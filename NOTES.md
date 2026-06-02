# Shelf Scanner Notes

## Admin Auth

### Current (Option A)
Admin dashboard at `admin.ivond.com` uses **password-based D1 auth**.
- Login at `admin.ivond.com/admin/` → email/password form → POST `/api/auth/login` → Worker checks `ADMIN_DB` (D1) → JWT
- Admin creds: `admin@store.com` / `admin123`
- Also supports `admin@ivond.com` + other users seeded in D1
- Manager/staff auth still goes through Supabase

### Future (Option B — Cloudflare Access path-scoped)
If you want passwordless admin login via Email OTP:
1. Create/modify Access app to protect only specific paths (not entire domain):
   - Destination: `admin.ivond.com/admin`
   - Destination: `admin.ivond.com/api`
2. Re-enable `<meta name="cf-access">` in `admin/index.html`
3. Re-enable cf-access auto-auth in `admin/js/app.js`
4. The `functions/_middleware.js` already handles 301 redirect from `/` to `/admin/`
5. `api/src/routes/cf-access.js` already exists to exchange Access identity header for JWT
6. This API token needs `Access: Apps and Policies` permission to configure via API

## Cloudflare API Token

Stored in `.env` as `CLOUDFLARE_API_TOKEN`.

- **Last 8 chars**: `1c56`
- **Permissions**: Workers Scripts (Edit), Cloudflare Pages (Edit)
- **To manage Access apps**: Need a new token with `Access: Apps and Policies` permission

### Load in PowerShell
```powershell
Get-Content .env | ForEach-Object { $name, $value = $_ -split '=', 2; Set-Item "env:$name" $value }
```

### Load in CMD
```cmd
for /f "tokens=1,2 delims==" %i in (.env) do set %i=%j
```

## Key IDs

| Item | ID |
|---|---|
| Cloudflare Account | `c1a9c77e51deb2655ceb8700c6723f3d` |
| Zone (ivond.com) | `ec6bafffc316940075e3082acc58b08b` |
| Supabase ref | `wlutqwabjuevlrvvrqjf` |
| Supabase region | `eu-central-1` |

## Workers

| Name | Route |
|---|---|
| `scanner-api` | `ivond.com/api/*` |

## Pages

| Project | Domains |
|---|---|
| `shelf-scanner` | `shelf-scanner.pages.dev`, `ivond.com` (pending SSL) |

## DNS (ivond.com zone)

| Name | Type | Target |
|---|---|---|
| `ivond.com` | CNAME proxied | `shelf-scanner.pages.dev` |
| `media.ivond.com` | CNAME proxied | `public.r2.dev` |

## Deploy Frontend
```powershell
$env:CLOUDFLARE_API_TOKEN = (Get-Content .env | Where-Object { $_ -match '^CLOUDFLARE_API_TOKEN=' } | ForEach-Object { $_ -split '=', 2 | Select-Object -Skip 1 })
npx wrangler pages deploy dist --project-name shelf-scanner --branch main
```

## Dev Commands
```powershell
npm run dev:backend   # Express API on :3001 (SQLite)
npm run dev           # Vite frontend on :5173
npm run build         # Build frontend to dist/
```
