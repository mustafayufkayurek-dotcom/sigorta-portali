const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({ ignoreHTTPSErrors:true });
  await page.goto('https://app.meridyen-tr.com/giris', { waitUntil:'networkidle' });
  await page.fill('input[type="email"]','admin@meridyenassistance.com');
  await page.fill('input[type="password"]','admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  await page.goto('https://app.meridyen-tr.com/panel/kullanicilar', { waitUntil:'networkidle' });
  await page.getByRole('button', { name:/Yeni Kullanıcı/i }).click();
  await page.waitForTimeout(1000);
  console.log(await page.locator('body').innerText());
  await browser.close();
})();
