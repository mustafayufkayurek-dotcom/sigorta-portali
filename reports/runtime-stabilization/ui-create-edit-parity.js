const path = require('path');

async function run() {
  const screenshotDir = process.argv[2];
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const unique = Date.now();
  const user = {
    firstName: 'Rt Parity',
    lastName: `User${unique}`,
    email: `rt.parity.${unique}@meridyenassistance.com`,
    password: 'Test1234!',
  };
  try {
    await page.goto(`${process.env.BASE_URL}/giris`, { waitUntil: 'networkidle' });
    await page.fill('input[type=\"email\"]', process.env.ADMIN_EMAIL);
    await page.fill('input[type=\"password\"]', process.env.ADMIN_PASSWORD);
    await page.click('button[type=\"submit\"]');
    await page.waitForLoadState('networkidle');
    await page.goto(`${process.env.BASE_URL}/panel/ayarlar/kurulum`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Yeni Kullanıcı', { timeout: 30000 });
    await page.getByRole('button', { name: /yeni kullanıcı/i }).click();
    await page.fill('input[name=\"firstName\"]', user.firstName).catch(() => {});
    await page.fill('input[name=\"lastName\"]', user.lastName).catch(() => {});
    await page.fill('input[name=\"email\"]', user.email).catch(() => {});
    await page.fill('input[type=\"password\"]', user.password).catch(() => {});
    const selects = await page.locator('select').all();
    if (selects[0]) await selects[0].selectOption({ index: 1 }).catch(() => {});
    await page.getByRole('button', { name: /kaydet|oluştur/i }).click().catch(() => {});
    await page.waitForLoadState('networkidle');
    const screenshot = path.join(screenshotDir, `test10-parity-${unique}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const bodyText = await page.textContent('body');
    const parity = Boolean(bodyText && bodyText.includes(user.email));
    console.log(JSON.stringify({ parity, screenshot, createdUserId: null, email: user.email }));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});