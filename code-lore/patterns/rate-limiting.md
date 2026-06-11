# Rate Limiting

## Overview

In-memory sliding-window rate limiter (`api/src/rate-limit.js`) for basic abuse protection. Each Worker isolate has its own memory, so limits are approximate across many instances — sufficient for free-tier protection.

## Core Function

```js
checkRateLimit(key, maxRequests = 20, windowMs = 60000)
// Returns: { allowed, remaining, resetIn }
```

## Middleware (`api/src/routes/rate-limit-middleware.js`)

Wraps `checkRateLimit` as a Hono middleware:

```js
rateLimit({ maxRequests: 20, windowMs: 60000, authenticated: false })
```

- `authenticated: true` — rate limits by user ID instead of IP
- Sets response headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
- Returns 429 with error message when limit exceeded

## Usage in Routes

Applied per-endpoint in `api/src/index.js`:
- Auth routes: stricter limits (e.g. 10/60s)
- Public endpoints: moderate limits (e.g. 30/60s)
- Authenticated API calls: higher limits (e.g. 100/60s)

## Cleanup

Stale entries (older than 60s) are lazily cleaned when the map exceeds 1000 entries.
