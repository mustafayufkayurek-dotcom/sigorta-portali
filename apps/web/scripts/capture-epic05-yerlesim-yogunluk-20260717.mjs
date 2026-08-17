/**
 * EPIC-05 — Yerleşim yoğunluk (Operasyon İşlemleri sol kolon + kompakt kartlar)
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-yerlesim-yogunluk-20260717.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE = process.env.CAPTURE_BASE || 'http://localhost:3001';
const API = process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';
const OUT = path.resolve(
  process.env.CAPTURE_OUT ||
    path.join(
      ROOT,
      'docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-yerlesim-yogunluk-20260717',
    ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';
const SEED_EMERGENCY_ID = process.env.EMERGENCY_CASE_ID || 'f4624c59-30e9-4380-8ac9-abb2f0c36757';

fs.mkdirSync(OUT, { recursive: true });

async function apiLogin() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  const data = loginJson?.data && typeof loginJson.data === 'object' ? loginJson.data : loginJson;
  const token =
    data?.accessToken
    || data?.access_token
    || data?.tokens?.accessToken
    || data?.tokens?.access_token
    || '';
  const refresh = data?.tokens?.refreshToken || data?.refreshToken || '';
  const user = data?.user || null;
  if (!token) throw new Error(`API login failed: ${loginRes.status}`);
  return { token, refresh, user };
}

async function injectAuth(page, { token, refresh, user }) {
  await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);
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
      accessToken: token,
      refreshToken: refresh,
      userJson: user ? JSON.stringify(user) : '',
      email: EMAIL,
    },
  );
}

async function resolveCase(token) {
  const headers = { Authorization: `Bearer ${token}` };
  const list = await fetch(`${API}/emergency/cases?limit=40`, { headers });
  const json = await list.json().catch(() => ({}));
  const raw = json?.data?.items || json?.data || json?.items || [];
  const items = Array.isArray(raw) ? raw : [];
  const openish = items.find((c) =>
    c?.id && ['GELEN', 'ATANDI'].includes(String(c.status || '')),
  );
  if (openish?.id) return { id: openish.id, source: `list-${openish.status}` };
  const byId = await fetch(`${API}/emergency/cases/${SEED_EMERGENCY_ID}`, { headers });
  if (byId.ok) return { id: SEED_EMERGENCY_ID, source: 'seed-id' };
  return { id: SEED_EMERGENCY_ID, source: 'fallback' };
}

async function main() {
  const auth = await apiLogin();
  const caseInfo = await resolveCase(auth.token);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await injectAuth(page, auth);
  await page.evaluate((caseId) => {
    localStorage.removeItem(`emergency-acil-flow:${caseId}`);
  }, caseInfo.id);

  await page.goto(`${BASE}/panel/acil-yardim/${caseInfo.id}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 45000 });
  await page.waitForSelector('[data-testid="fiyat-giris"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="hizli-islemler"]', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Google Alternatifleri sekmesi — boş durum yoğunluğu
  const altTab = page.locator('[data-testid="sekme-alternatif-oneriler"]');
  if (await altTab.count()) {
    await altTab.click();
    await page.waitForTimeout(800);
  }

  const metrics = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="operasyon-iki-kolon"]');
    const ops = document.querySelector('[data-testid="hizli-islemler"]');
    const vendor = document.querySelector('[data-testid="tedarikci-onerileri"]');
    const budget = document.querySelector('[data-testid="fiyat-giris"]');
    const cards = [...document.querySelectorAll('[data-testid="hizli-islem-kartlari"] > *')];
    const firstCard = cards[0];
    const cardStyle = firstCard ? getComputedStyle(firstCard) : null;
    const opsRect = ops?.getBoundingClientRect();
    const vendorRect = vendor?.getBoundingClientRect();
    const budgetRect = budget?.getBoundingClientRect();
    const gapVendorToOps =
      opsRect && vendorRect ? Math.max(0, opsRect.top - vendorRect.bottom) : null;
    return {
      opsCount: document.querySelectorAll('[data-testid="hizli-islemler"]').length,
      opsInsideGrid: Boolean(grid && ops && grid.contains(ops)),
      opsBelowVendor:
        opsRect && vendorRect
          ? opsRect.top >= vendorRect.bottom - 4 && Math.abs(opsRect.left - vendorRect.left) < 40
          : false,
      gapVendorToOps,
      opsBesideBudget:
        opsRect && budgetRect
          ? opsRect.left < budgetRect.left - 40 && opsRect.top < budgetRect.bottom
          : false,
      firstCardHeight: firstCard?.getBoundingClientRect().height ?? 0,
      firstCardAspectSquare: cardStyle ? cardStyle.aspectRatio === '1 / 1' : null,
      cardCount: cards.length,
      emptyAlert: Boolean(
        document.querySelector('[data-testid="alternatif-bos-uyari"]')
        || document.querySelector('[data-testid="sekme-alternatif-icerik"] .bg-amber-50'),
      ),
    };
  });

  const shotPath = path.join(OUT, '01-desktop.png');
  await page.locator('[data-testid="operasyon-iki-kolon"]').screenshot({ path: shotPath });

  const fullPath = path.join(OUT, '01-tam-sayfa-desktop.png');
  await page.screenshot({ path: fullPath, fullPage: true });

  const pass =
    metrics.opsCount === 1
    && metrics.opsInsideGrid
    && metrics.opsBelowVendor
    && metrics.gapVendorToOps != null
    && metrics.gapVendorToOps < 24
    && metrics.firstCardHeight > 0
    && metrics.firstCardHeight < 90
    && metrics.firstCardAspectSquare === false
    && metrics.cardCount >= 5;

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    caseInfo,
    shotPath,
    fullPath,
    metrics,
    pass,
  };

  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
