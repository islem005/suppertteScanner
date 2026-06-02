# Cloudflare Free Tier Usage Rules

Account: Salimkawi2020@gmail.com's Account (type: standard — on Workers Free plan)

## Golden Rule

**Never upgrade to Workers Paid.** The minimum is $5/month. If a feature requires the paid plan, find an alternative. Exceeding free tier limits is **hard-blocked** (API returns errors), not auto-billed.

---

## A: Safe to Use (Free & Included)

| Service | Free Limit | Notes |
|---|---|---|
| **Workers** | 100,000 req/day, 10ms CPU/req, 128 MB, 100 scripts | Our main use case |
| **Workers KV** | 100K reads/day, 1K writes/day, 1 GB storage | For config/secrets |
| **D1** | 5M rows read/day, 100K rows written/day, 5 GB total | Our database |
| **R2** | 10 GB-month free, 1M Class A ops, 10M Class B ops, free egress | File storage |
| **Workers AI** | 10,000 neurons/day | Light AI tasks |
| **Workers Logs** | 7-day retention, 5B logs/day cap | Observability |
| **AI Search** | 100 instances, 100K files each, 20K queries/month | Only if needed |
| **Pages** | Unlimited static asset requests, 500 builds/month | Hosting |
| **Cron Triggers** | 5 per account | Scheduled tasks |
| **Custom Domains** | Unlimited | Route to Workers |

## B: Use Sparingly (Hard Limits, Exceeding = Errors)

| Service | Limit | Consequence |
|---|---|---|
| **Browser Rendering** | 10 min/day, 3 concurrent | Capped at 10 min/day |
| **Workers AI** | 10,000 neurons/day | Capped at 10K/day |
| **D1 rows written** | 100K/day | Queries fail until reset (00:00 UTC) |
| **Workers KV writes** | 1,000/day | Writes fail until reset |

## C: DO NOT USE (Charges Incurred)

| Service | Why | Alternative |
|---|---|---|
| **Containers** | Not on free plan | Use Workers instead |
| **Vectorize** | Paid-only | Use Workers AI embeddings |
| **Workflows** (beta) | May become paid | Use Cron Triggers + D1 |
| **Durable Objects KV backend** | Paid-only | Use SQLite-backed DO (free) |
| **R2 Infrequent Access** | No free tier for IA | Use standard R2 storage only |
| **R2 Data Catalog / R2 SQL** | Billed separately | Avoid unless needed |
| **Stream** | Pay-per-minute | Use static files + R2 |
| **Realtime** | Pay-per-minute | WebSocket + DO |
| **Turnstile** | Free up to 1M siteverify/mo | OK if within limit |
| **Workers Paid upgrade** | $5/mo minimum | **Never do this** |

## D: Project-Specific Rules for Shelf Scanner

### Workers
- Keep under 100,000 requests/day across all Workers
- Each request must complete in under 10ms CPU time
- Max 50 subrequests per invocation
- Max 100 Workers scripts total
- Max 5 cron triggers per account

### D1 (primary database — replaces Supabase)
- Max 5 million rows read/day
- Max 100,000 rows written/day
- Max 5 GB total storage
- Database queries must be efficient — avoid full table scans
- Use pagination (LIMIT/OFFSET) on product lookups
- Better Auth session/account/user tables share D1 quota

### R2
- Max 10 GB stored total
- Max 1 million Class A operations/month (writes, lists)
- Max 10 million Class B operations/month (reads)
- Storage is free; operations are the scarce resource

### Workers AI
- Max 10,000 neurons/day
- Per-model neuron costs vary — check before using
- For text generation: ~1 neuron ≈ 1 token
- Keep to occasional use only

### Browser Rendering
- Max 10 minutes per day, 3 concurrent browsers
- Only use for testing screenshots, never in production

### KV
- 100,000 reads/day, 1,000 writes/day, 1 GB
- Use for session tokens, config, not as primary database

## E: Monitoring

Check usage at: https://dash.cloudflare.com/?to=/:account/workers/plans
- Workers Free dashboard shows daily request count
- D1 dashboard shows rows read/written
- Workers AI dashboard shows neuron usage
- R2 dashboard shows storage + operations

## F: What Happens on Exceeding Free Tiers

- **Workers:** Returns Error 1027 until reset
- **D1:** Queries return errors until daily reset (00:00 UTC)
- **KV:** Operations of that type fail until daily reset
- **Workers AI:** Operations fail until daily reset
- **Browser Rendering:** Automatically capped at limit

None auto-bill. You stay on free plan unless you explicitly upgrade.

## G: Summary Checklist Before Deploying Anything

1. Does it use a paid-only service? → ❌ Stop
2. Will it exceed free tier daily limits at expected scale? → ❌ Optimize
3. Does it need Workers Paid plan features? → ❌ Find free alternative
4. Is it for dev/testing only (small scale)? → ✅ Go ahead
