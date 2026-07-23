/**
 * Eksper Portalı FINAL MASTER — referans JPEG hizası capture
 * node apps/web/scripts/capture-eksper-portal-final-20260723.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.argv[2] || process.env.CAPTURE_BASE || 'http://localhost:3001';
const API = process.argv[3] || process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';
const OUT =
  process.argv[6] ||
  path.resolve(
    process.cwd(),
    'docs/project-governance/canli-kabul/ekran-goruntuleri/eksper-portal-final-20260723',
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
  if (!token) throw new Error(`API login failed: ${loginRes.status} email=${email}`);
  return { token, refresh, user };
}

async function injectAuth(page, auth, email) {
  await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(300);
  await page.evaluate(
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
      if (userJson) localStorage.setItem('user', userJson);
    },
    {
      accessToken: auth.token,
      refreshToken: auth.refresh,
      userJson: auth.user ? JSON.stringify(auth.user) : '',
      emailUsed: email,
    },
  );
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@meridyenassistance.com';
  const adminPass = process.env.ADMIN_PASSWORD || process.env.LOGIN_PASSWORD || 'admin123';
  const base = await apiLogin(adminEmail, adminPass);
  const auth = {
    token: base.token,
    refresh: base.refresh,
    user: {
      ...(base.user || {}),
      mustChangePassword: false,
      role: { ...(base.user?.role || {}), code: 'expert', name: 'Eksper Portalı' },
      firstName: 'Eksper',
      lastName: 'Test',
    },
  };
  const emailUsed = adminEmail;
  const role = 'expert';

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: auth.user, success: true }),
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
    ({ accessToken, refreshToken, userJson, email }) => {
      const now = Date.now();
      try {
        sessionStorage.setItem('meridyenBrowserSession', '1');
        sessionStorage.setItem('meridyenAuthTab', '1');
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('meridyenRememberMe', '1');
        localStorage.setItem('authPersistence', 'remember');
        localStorage.setItem('tokenExpiry', String(now + 7 * 24 * 60 * 60 * 1000));
        localStorage.setItem('meridyenLastAuthActivity', String(now));
        localStorage.setItem('rememberedEmail', email);
        if (userJson) localStorage.setItem('user', userJson);
      } catch {
        /* ignore */
      }
    },
    {
      accessToken: auth.token,
      refreshToken: auth.refresh,
      userJson: JSON.stringify(auth.user),
      email: emailUsed,
    },
  );

  await injectAuth(page, auth, emailUsed);
  await page.goto(`${BASE}/panel/eksper-portal`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  for (const sel of [
    'button:has-text("Şimdi Değil")',
    'button[aria-label="Sözleşme penceresini kapat"]',
  ]) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  if (!page.url().includes('/panel/eksper-portal')) {
    await page.goto(`${BASE}/panel/eksper-portal`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(5000);
  }

  const url = page.url();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const title =
    (await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null))?.trim() ||
    (bodyText.includes('Eksper Paneli') ? 'Eksper Paneli' : '');

  const checks = {
    hasDosyalarimAktif: bodyText.includes('Dosyalarım (Aktif)') ? 1 : 0,
    hasWhatsApp: bodyText.includes('WhatsApp Destek') ? 1 : 0,
    hasDosyaHareket: bodyText.includes('Güncel Dosya Hareketleri') ? 1 : 0,
    hasSureAnalizi: bodyText.includes('Süre Analizi') ? 1 : 0,
    hasHizliOzet: bodyText.includes('Hızlı Özet') ? 1 : 0,
    hasOldTitle: bodyText.includes('Son Dosya Aktiviteleri') ? 1 : 0,
    hasIsYuku: bodyText.includes('İş Yükü Trendi') ? 1 : 0,
    hasHizliIslemler: bodyText.includes('Hızlı İşlemler') ? 1 : 0,
    denied: bodyText.includes('Bu sayfa eksperler içindir') ? 1 : 0,
  };
  const idxWa = bodyText.indexOf('WhatsApp Destek');
  const idxYeni = bodyText.indexOf('Yeni İhbar');
  const idxKpi = bodyText.indexOf('Dosyalarım (Aktif)');
  const idxTitle = bodyText.indexOf('Eksper Paneli');
  const idxHareket = bodyText.indexOf('Güncel Dosya Hareketleri');
  // Sıra: başlık → iletişim → Yeni İhbar → KPI → alt içerik
  checks.contactAboveYeniIhbar =
    idxTitle >= 0 && idxWa > idxTitle && idxYeni > idxWa && idxKpi > idxYeni && (idxHareket < 0 || idxKpi < idxHareket)
      ? 1
      : 0;

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, 'desktop-1440-full.png'), fullPage: true });

  const publicCmp = path.resolve(process.cwd(), 'apps/web/public/_ui-cmp/current.png');
  fs.mkdirSync(path.dirname(publicCmp), { recursive: true });
  fs.copyFileSync(path.join(OUT, 'desktop-1440-full.png'), publicCmp);

  const report = {
    ok:
      checks.denied === 0 &&
      checks.hasDosyalarimAktif > 0 &&
      checks.hasWhatsApp > 0 &&
      checks.hasDosyaHareket > 0 &&
      checks.hasSureAnalizi > 0 &&
      checks.hasHizliOzet > 0 &&
      checks.contactAboveYeniIhbar > 0 &&
      checks.hasOldTitle === 0 &&
      checks.hasIsYuku === 0 &&
      checks.hasHizliIslemler === 0 &&
      /Eksper/i.test(title || bodyText),
    title,
    url,
    role,
    email: emailUsed,
    checks,
    bodySnippet: bodyText.slice(0, 1000),
    screenshots: ['desktop-1440-full.png'],
  };
  fs.writeFileSync(path.join(OUT, 'CAPTURE.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
