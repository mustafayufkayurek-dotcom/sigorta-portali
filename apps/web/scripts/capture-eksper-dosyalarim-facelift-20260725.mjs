import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../../..');
const BASE = process.env.CAPTURE_BASE || 'http://localhost:3001';
const API = process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';
const OUT = path.join(REPO, 'docs/project-governance/canli-kabul/ekran-goruntuleri/eksper-dosyalarim-enterprise-facelift-20260725');
fs.mkdirSync(OUT, { recursive: true });

async function loginAsExpert(page) {
  // try known local experts / admin won't work for gate
  const candidates = [
    { email: process.env.EXPERT_EMAIL || 'eksper@meridyenassistance.com', password: process.env.EXPERT_PASSWORD || process.env.LOGIN_PASSWORD || 'admin123' },
    { email: 'expert@meridyenassistance.com', password: 'admin123' },
    { email: 'admin@meridyenassistance.com', password: 'admin123' },
  ];
  let lastErr = '';
  for (const c of candidates) {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    const json = await loginRes.json().catch(() => ({}));
    const token = json?.data?.tokens?.accessToken;
    const user = json?.data?.user;
    if (!token) {
      lastErr = `${c.email}:${loginRes.status}`;
      continue;
    }
    await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ token: t, refresh, user: u }) => {
      const now = Date.now();
      localStorage.setItem('token', t);
      localStorage.setItem('accessToken', t);
      localStorage.setItem('refreshToken', refresh || '');
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('meridyenRememberMe', '1');
      localStorage.setItem('authPersistence', 'remember');
      localStorage.setItem('tokenExpiry', String(now + 7 * 24 * 60 * 60 * 1000));
      localStorage.setItem('meridyenLastAuthActivity', String(now));
    }, { token, refresh: json?.data?.tokens?.refreshToken, user });
    return { email: c.email, role: user?.role?.code };
  }
  throw new Error(`No login worked: ${lastErr}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  const auth = await loginAsExpert(page);
  await page.goto(`${BASE}/panel/eksper-portal/dosyalar`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  const url = page.url();
  await page.screenshot({ path: path.join(OUT, '01-dosyalarim-1440.png'), fullPage: true });
  const kpi = await page.locator('[data-testid="eksper-dosyalar-kpi"]').count();
  const filtre = await page.locator('[data-testid="eksper-dosyalar-filtre"]').count();
  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify({ at: new Date().toISOString(), auth, url, kpi, filtre }, null, 2));
  console.log(JSON.stringify({ ok: true, auth, url, kpi, filtre, out: OUT }, null, 2));
} finally {
  await browser.close();
}
