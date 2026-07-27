/**
 * Sigorta Portalı — Türkiye Operasyon Referans Ağı local capture
 * node apps/web/scripts/capture-sigorta-portal-referans-agi-20260725.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const WEB = process.env.WEB_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://127.0.0.1:3000/api/v1';
const OUT = path.resolve(
  process.cwd(),
  'docs/project-governance/canli-kabul/ekran-goruntuleri/sigorta-portal-referans-agi-20260725',
);
fs.mkdirSync(OUT, { recursive: true });

async function apiLogin(email, password) {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  const data = loginJson?.data && typeof loginJson.data === 'object' ? loginJson.data : loginJson;
  const token = data?.accessToken || data?.tokens?.accessToken || '';
  const refresh = data?.tokens?.refreshToken || data?.refreshToken || '';
  const user = data?.user || null;
  if (!token) throw new Error(`API login failed: ${loginRes.status}`);
  return { token, refresh, user };
}

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@meridyenassistance.com';
  const password = process.env.ADMIN_PASSWORD || process.env.LOGIN_PASSWORD || 'admin123';
  const base = await apiLogin(email, password);

  const insuranceUser = {
    ...(base.user || {}),
    mustChangePassword: false,
    role: {
      ...(base.user?.role || {}),
      code: 'insurance_company_user',
      name: 'Sigorta Şirketi Kullanıcısı',
    },
    insuranceCompanyId: base.user?.insuranceCompanyId || 'local-ref-scope',
    firstName: 'Sigorta',
    lastName: 'Test',
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: insuranceUser, success: true }),
    });
  });
  await page.route('**/agreements/pending**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.addInitScript(
    ({ accessToken, refreshToken, userJson, emailUsed }) => {
      const now = Date.now();
      sessionStorage.setItem('meridyenBrowserSession', '1');
      sessionStorage.setItem('meridyenAuthTab', '1');
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('meridyenRememberMe', '1');
      localStorage.setItem('authPersistence', 'remember');
      localStorage.setItem('tokenExpiry', String(now + 7 * 24 * 60 * 60 * 1000));
      localStorage.setItem('meridyenLastAuthActivity', String(now));
      localStorage.setItem('rememberedEmail', emailUsed);
      localStorage.setItem('user', userJson);
    },
    {
      accessToken: base.token,
      refreshToken: base.refresh,
      userJson: JSON.stringify(insuranceUser),
      emailUsed: email,
    },
  );

  await page.goto(`${WEB}/panel/sigorta-portal`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);

  // dismiss modals
  for (let i = 0; i < 3; i++) {
    const btn = page.getByRole('button', { name: /Kapat|Tamam|Anladım|Vazgeç/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(250);
    } else break;
  }

  const body = await page.locator('body').innerText();
  const checks = {
    title: body.includes('Türkiye Operasyon Referans Ağı') ? 1 : 0,
    noBizimDosyalar: !body.includes('Bizim Dosyalar') ? 1 : 0,
    noMeridyenHasarAgi: !body.includes('Meridyen Hasar Ağı') ? 1 : 0,
    noSonOnay: !body.includes('Son Onay İstekleri') ? 1 : 0,
    hasKpi: body.includes('Konut Operasyonları') && body.includes('Hizmet Verilen İl') ? 1 : 0,
    hasFeatured: body.includes('Son Öne Çıkan Operasyonlar') ? 1 : 0,
    hasPrivacy: body.includes('Operasyon Gizliliği') ? 1 : 0,
    hasWhyNoPhoto: body.includes('Neden Operasyon Fotoğrafları Bulunmuyor') ? 1 : 0,
    hasFooter: body.includes('Meridyen Hakkında Daha Fazla') ? 1 : 0,
    denied: body.includes('Bu Sayfa Sigorta') && !body.includes('Türkiye Operasyon Referans Ağı') ? 1 : 0,
  };

  await page.screenshot({ path: path.join(OUT, 'desktop-1440-full.png'), fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'tablet-768-full.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'mobile-390-full.png'), fullPage: true });

  // popup: click first featured
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${WEB}/panel/sigorta-portal`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const featured = page.locator('button').filter({ hasText: /ROKETSAN|DHMİ|Konut|Endüstriyel/i }).first();
  if (await featured.isVisible().catch(() => false)) {
    await featured.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(OUT, 'desktop-1440-popup.png'), fullPage: true });

  const ok =
    checks.denied === 0 &&
    checks.title === 1 &&
    checks.noBizimDosyalar === 1 &&
    checks.noMeridyenHasarAgi === 1 &&
    checks.noSonOnay === 1 &&
    checks.hasKpi === 1 &&
    checks.hasFeatured === 1 &&
    checks.hasPrivacy === 1 &&
    checks.hasWhyNoPhoto === 1 &&
    checks.hasFooter === 1;

  const report = { ok, checks, url: page.url(), bodySnippet: body.slice(0, 800) };
  fs.writeFileSync(path.join(OUT, 'CAPTURE.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
