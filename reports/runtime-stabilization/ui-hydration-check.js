const fs = require('fs');
const path = require('path');

async function run() {
  const userId = process.argv[2];
  const screenshotDir = process.argv[3];
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  try {
    await page.goto(`${process.env.BASE_URL}/giris`, { waitUntil: 'networkidle' });
    await page.fill('input[type=\"email\"]', process.env.ADMIN_EMAIL);
    await page.fill('input[type=\"password\"]', process.env.ADMIN_PASSWORD);
    await page.click('button[type=\"submit\"]');
    await page.waitForLoadState('networkidle');
    await page.goto(`${process.env.BASE_URL}/panel/ayarlar/kurulum`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Kullanıcılar', { timeout: 30000 });
    await page.getByRole('button', { name: /düzenle/i }).first().click().catch(() => {});
    if (userId) {
      await page.goto(`${process.env.BASE_URL}/panel/kullanicilar/${userId}`, { waitUntil: 'networkidle' }).catch(() => {});
    }
    const screenshot = path.join(screenshotDir, `test1-hydration-${Date.now()}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const content = await page.content();
    const hydrated = /Kullanıcılar|Ad|Soyad|E-posta/.test(content);
    console.log(JSON.stringify({ hydrated, screenshot }));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});