import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const base = process.env.BASE_URL || 'http://localhost:3000'
const out = resolve('public', 'manual')

await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'es-CU' })
const page = await context.newPage()

for (const route of [{ slug: 'portada', path: '/' }, { slug: 'login', path: '/login' }]) {
  await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
  await page.screenshot({ path: resolve(out, `${route.slug}.png`), animations: 'disabled', scale: 'css' })
  console.log(`captured ${route.path} -> public/manual/${route.slug}.png`)
}

await browser.close()
