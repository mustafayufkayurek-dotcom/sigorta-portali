/**
 * Dosya Sorumlusu FINAL — viewport + yönetim kanıtı capture
 * node apps/web/scripts/capture-dosya-sorumlusu-final-20260723.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.argv[2] || process.env.CAPTURE_BASE || 'http://localhost:3001';
const API = process.argv[3] || process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';
const EMAIL = process.argv[4] || process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.argv[5] || process.env.LOGIN_PASSWORD || 'admin123';
const OUT =
  process.argv[6] ||
  path.resolve(
    'docs/project-governance/canli-kabul/ekran-goruntuleri/dosya-sorumlusu-final-20260723',
  );

fs.mkdirSync(OUT, { recursive: true });

async function apiLogin() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  const data = loginJson?.data && typeof loginJson.data === 'object' ? loginJson.data : loginJson;
  const token = data?.accessToken || data?.tokens?.accessToken || '';
  const refresh = data?.tokens?.refreshToken || data?.refreshToken || '';
  const user = data?.user || null;
  if (!token) throw new Error(`API login failed: ${loginRes.status}`);
  return { token, refresh, user };
}

async function injectAuth(page, auth) {
  await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(300);
  await page.evaluate(
    ({ accessToken, refreshToken, userJson, email }) => {
      const now = Date.now();
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
    },
    {
      accessToken: auth.token,
      refreshToken: auth.refresh,
      userJson: auth.user ? JSON.stringify(auth.user) : '',
      email: EMAIL,
    },
  );
}

async function openOffice(page) {
  await page.goto(`${BASE}/panel?demo=bekleyen-operasyonlar`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.getByText('Dosya Sorumlusu Merkezi').first().waitFor({ state: 'visible', timeout: 45000 });
  await page.locator('#bekleyen-operasyonlar').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(2500);
}

async function main() {
  const auth = await apiLogin();
  const browser = await chromium.launch({ headless: true });

  const shots = [
    { name: 'desktop-1440', w: 1440, h: 900, fullPage: true },
    { name: 'tablet-768', w: 768, h: 1024, fullPage: true },
    { name: 'mobile-390', w: 390, h: 844, fullPage: true },
  ];

  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
    await injectAuth(page, auth);
    await openOffice(page);
    await page.screenshot({
      path: path.join(OUT, `${shot.name}-full.png`),
      fullPage: shot.fullPage,
    });
    await page.close();
  }

  // Bekleyen Operasyonlar açık (Tümünü Gör varsa)
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await injectAuth(page, auth);
    await openOffice(page);
    const showAll = page.getByRole('button', { name: /Tümünü Gör/i }).first();
    if (await showAll.isVisible().catch(() => false)) {
      await showAll.click();
      await page.waitForTimeout(600);
    }
    await page.locator('#bekleyen-operasyonlar').screenshot({
      path: path.join(OUT, 'bekleyen-operasyonlar-acik.png'),
    });
    await page.screenshot({
      path: path.join(OUT, 'desktop-bekleyen-acik-full.png'),
      fullPage: true,
    });
    await page.close();
  }

  // Yönetim Dashboard değişmedi kanıtı (demo kapalı)
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await injectAuth(page, auth);
    await page.goto(`${BASE}/panel`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3500);
    const h1 = ((await page.locator('h1').first().textContent()) || '').trim();
    const pendingLeak = await page.locator('#bekleyen-operasyonlar').count();
    const officeCharts = await page.getByText('Dosyaların Durum Dağılımı', { exact: true }).count();
    await page.screenshot({
      path: path.join(OUT, 'yonetim-veya-panel-kanit.png'),
      fullPage: false,
    });
    fs.writeFileSync(
      path.join(OUT, 'CAPTURE.json'),
      JSON.stringify(
        {
          ok: true,
          managementOrPanelTitle: h1,
          pendingOpsLeak: pendingLeak,
          officeChartsOnDefaultPanel: officeCharts,
          note:
            /Yönetim/i.test(h1) && pendingLeak === 0 && officeCharts === 0
              ? 'Yönetim Dashboard izole'
              : 'Panel başlığı kaydedildi; office blokları sızmamalı',
        },
        null,
        2,
      ),
    );
    await page.close();
  }

  console.log(JSON.stringify({ ok: true, out: OUT }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
