import { Hono } from 'hono'
import { authenticate, adminOnly } from '../middleware.js'

const router = new Hono()
router.use('*', authenticate, adminOnly)

const ALLOWED_DEPARTMENTS = {
  'contact': 'contact@ivond.com',
  'sales': 'sales@ivond.com',
  'support': 'support@ivond.com',
  'info': 'info@ivond.com',
}

router.post('/send', async (c) => {
  try {
    const { from, to, subject, body, type, attachments } = await c.req.json()

    if (!from || !to || !subject || !body) {
      return c.json({ error: 'from, to, subject, and body are required' }, 400)
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return c.json({ error: 'Invalid recipient email address' }, 400)
    }

    let fromAddress
    if (ALLOWED_DEPARTMENTS[from]) {
      fromAddress = ALLOWED_DEPARTMENTS[from]
    } else if (from.endsWith('@ivond.com') && emailRegex.test(from)) {
      fromAddress = from
    } else {
      return c.json({ error: 'Invalid from address. Use a department or valid @ivond.com address' }, 400)
    }

    const payload = {
      sender: { email: fromAddress, name: fromAddress.split('@')[0] },
      to: [{ email: to, name: '' }],
      subject,
    }

    if (type === 'text') {
      payload.textContent = body
    } else {
      payload.htmlContent = body
      payload.textContent = body.replace(/<[^>]*>/g, '')
    }

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      payload.attachment = attachments.map(a => ({
        name: a.filename || 'attachment',
        content: a.content,
      }))
    }

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': c.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await brevoRes.json()

    if (!brevoRes.ok) {
      return c.json({ error: result.message || 'Failed to send email' }, brevoRes.status)
    }

    return c.json({ success: true, messageId: result.messageId })
  } catch (err) {
    console.error('Email send error:', err)
    return c.json({ error: err.message || 'Failed to send email' }, 500)
  }
})

export { router as emailRouter }
