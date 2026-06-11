# CSRF Protection

## Overview

A Hono middleware (`api/src/csrf.js`) protects all non-GET API endpoints from CSRF attacks.

## Middleware Logic

- **Safe methods** (GET, HEAD, OPTIONS) pass through without check
- **Public endpoints** (auth, health, lookup, scans, branding, etc.) are exempt
- **Origin check** — requires `Origin` or `Referer` header to be one of:
  - `https://ivond.com`
  - `https://admin.ivond.com`
  - `*.ivond.com` subdomains (regex)
  - `http://localhost:*` (dev)
- **Token check** — requires `X-CSRF-Token` header with value `skaner-csrf-token`

## Where Applied

Applied globally in `api/src/index.js` via `c.use()` — covers all `/api/*` routes before authentication.

## Exempt Endpoints

Paths starting with any of these skip CSRF checks:
`/api/auth/sign-in`, `/api/auth/sign-up`, `/api/auth/cf-access`, `/api/health`, `/api/lookup`, `/api/page-views`, `/api/scans`, `/api/branding`, `/api/promotions/banners`, `/api/promotions/offers`, `/api/discounts/featured`, `/api/stores/slug`, `/api/debug`
