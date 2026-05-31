import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRouter } from './routes/auth.js'
import { storesRouter } from './routes/stores.js'
import { productsRouter } from './routes/products.js'
import { lookupRouter } from './routes/lookup.js'
import { scansRouter } from './routes/scans.js'
import { brandingRouter } from './routes/branding.js'
import { adminRouter } from './routes/admin.js'
import { importsRouter } from './routes/imports.js'
import { promotionsRouter } from './routes/promotions.js'
import { discountsRouter } from './routes/discounts.js'
import { cfAccessRouter } from './routes/cf-access.js'

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Type']
}))

app.route('/api/auth', authRouter)
app.route('/api/stores', storesRouter)
app.route('/api/products', productsRouter)
app.route('/api/lookup', lookupRouter)
app.route('/api/scans', scansRouter)
app.route('/api/branding', brandingRouter)
app.route('/api/admin', adminRouter)
app.route('/api/imports', importsRouter)
app.route('/api/promotions', promotionsRouter)
app.route('/api/discounts', discountsRouter)
app.route('/api/auth/cf-access', cfAccessRouter)

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/', (c) => c.json({ name: 'Shelf Scanner API', version: '1.0.0', status: 'running' }))

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

export default app
