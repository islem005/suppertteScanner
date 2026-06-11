# Email Sending Pattern

## Overview

Email is sent via the **Brevo API** (formerly Sendinblue). Only admins can send emails (enforced by `authenticate` + `adminOnly` middleware). The API key is stored as a Worker secret (`BREVO_API_KEY`).

## API Route

`POST /api/email/send` in `api/src/routes/email.js`

### Request Body

```json
{
  "from": "contact | sales | support | info | <custom@ivond.com>",
  "to": "recipient@example.com",
  "subject": "Email subject",
  "body": "<html> or text content",
  "type": "html (default) | text",
  "attachments": [
    {
      "filename": "file.pdf",
      "content": "<base64-encoded content>"
    }
  ]
}
```

### From Address Validation

- Predefined departments: `contact@ivond.com`, `sales@ivond.com`, `support@ivond.com`, `info@ivond.com`
- Custom: any valid email ending with `@ivond.com`
- `from` field accepts the short name for departments (e.g. `"contact"`) or full email for custom

### Attachment Handling

- Client: file read via `FileReader.readAsDataURL()` → strip data URL prefix → base64 string
- API: passes base64 directly to Brevo's `attachment[n].content` field (Brevo expects raw base64)

## Transport

Uses `fetch()` to `https://api.brevo.com/v3/smtp/email` with the Brevo API key.

```
BREVO_API_KEY → Worker secret (not in config files)
```

Previously used the Cloudflare Workers `send_email` binding — removed because it requires Workers Paid plan.

## DNS Requirements (for deliverability)

When domain `ivond.com` is added in Brevo, it provides DNS records to publish in Cloudflare:

1. **Brevo code** — TXT record for domain ownership verification
2. **DKIM** — TXT record with Brevo's DKIM selector
3. **SPF** — Add `include:spf.sendinblue.com` or `include:spf.brevo.com` to the existing SPF TXT record

## Frontend (Admin Panel)

- Nav item: "Email" with send icon, placed between Branding and Activity
- Form: from dropdown (contact/sales/support/info + custom text input), to, subject, body (textarea), file picker
- File-to-base64 conversion inline using `FileReader`
- `admin/js/api.js` method: `sendEmail({ from, to, subject, body, type, attachments })`
