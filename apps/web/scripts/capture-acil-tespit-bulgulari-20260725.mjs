/**
 * Local: Yeni Acil Yardım formu — Tespit Bulguları alanı
 * LOGIN_EMAIL=admin@meridyenassistance.com node apps/web/scripts/capture-acil-tespit-bulgulari-20260725.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const BASE = process.env.CAPTURE_BASE || 'http://localhost:3001';
const API = process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.ADMIN_PASSWORD || process.env.LOGIN_PASSWORD || 'admin123';
const OUT = path.join(
  REPO_ROOT,
  'docs/project-governance/canli-kabul/ekran-goruntuleri/acil-tespit-bulgulari-20260725',
);

fs.mkdirSync(OUT, { recursive: true });

async function login(page) {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  const json = await loginRes.json();
  const token = json?.data?.tokens?.accessToken || json?.data?.accessToken || '';
  const refresh = json?.data?.tokens?.refreshToken || '';
  const user = json?.data?.user;
  if (!token) throw new Error(`No token in login response: ${JSON.stringify(json).slice(0, 300)}`);
  await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token: t, refresh: r, user: u }) => {
    const now = Date.now();
    localStorage.setItem('token', t);
    localStorage.setItem('accessToken', t);
    localStorage.setItem('refreshToken', r);
    localStorage.setItem('meridyenRememberMe', '1');
    localStorage.setItem('authPersistence', 'remember');
    localStorage.setItem('tokenExpiry', String(now + 7 * 24 * 60 * 60 * 1000));
    localStorage.setItem('meridyenLastAuthActivity', String(now));
    if (u) localStorage.setItem('user', JSON.stringify(u));
  }, { token, refresh, user });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await login(page);
  await page.goto(`${BASE}/panel/operasyon?filter=acil&yeni=1`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const findings = page.locator('[data-testid="tespit-bulgulari-input"]');
  await findings.waitFor({ timeout: 20000 });
  await findings.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, '01-yeni-acil-form-1440.png'), fullPage: true });
  await page.screenshot({ path: path.join(OUT, '02-tespit-bulgulari-alan-1440.png') });

  const saveBtn = page.locator('button[type="submit"]', { hasText: 'Dosyayı Oluştur' }).first();
  await saveBtn.click({ force: true });
  await page.waitForTimeout(800);
  await findings.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, '03-tespit-bulgulari-zorunlu-hata-1440.png') });

  const errVisible = await page.locator('[data-testid="tespit-bulgulari-error"]').isVisible().catch(() => false);
  const labelText = await page.locator('#tespit-bulgulari label').innerText().catch(() => '');
  fs.writeFileSync(
    path.join(OUT, 'EVIDENCE.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base: BASE,
        url: `${BASE}/panel/operasyon?filter=acil&yeni=1`,
        labelText,
        requiredErrorVisible: errVisible,
        fieldPresent: (await findings.count()) > 0,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ ok: true, errVisible, labelText, out: OUT }, null, 2));
} finally {
  await browser.close();
}
