import { chromium } from 'playwright'

const base = process.env.BASE_URL || 'http://localhost:3000'
const browser = await chromium.launch({ headless: true, channel: 'chromium' })

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport })
  const response = await page.goto(`${base}/manual`, { waitUntil: 'domcontentloaded' })
  if (!page.url().includes('/login?next=%2Fmanual') && !page.url().includes('/login?next=/manual')) throw new Error(`${viewport.name}: /manual did not redirect an anonymous user to login (${page.url()})`)
  if (!response || response.status() >= 500) throw new Error(`${viewport.name}: manual request returned ${response?.status()}`)
  await page.getByRole('heading', { name: 'Bienvenido' }).waitFor()
  console.log(`${viewport.name}: protected redirect and login layout OK`)
  await page.close()
}

const assets = await browser.newPage()
for (const path of ['/manual/portada.png', '/manual/login.png']) {
  const response = await assets.goto(`${base}${path}`)
  if (!response?.ok()) throw new Error(`${path} returned ${response?.status()}`)
  console.log(`${path}: ${response.status()} OK`)
}
await browser.close()
