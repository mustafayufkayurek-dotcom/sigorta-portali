/**
 * EPIC-06 — Tedarikçi Profili 2.0 local kanıt
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic06-tedarikci-profili-20260716.mjs
 *
 * Not: BASE host, NEXT_PUBLIC_API_URL host ile uyumlu olmalı (localhost↔127.0.0.1 karışımı
 * panel guard’ı /giris’e düşürür).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.CAPTURE_BASE || 'http://localhost:3001';
const API = process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';
const OUT = path.resolve(
  process.env.CAPTURE_OUT
  || path.join(
    __dirname,
    '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/epic06-tedarikci-profili-20260716',
  ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';
const VENDOR_ID = process.env.VENDOR_ID || '';

const viewports = [
  { name: '01-desktop', width: 1440, height: 900 },
  { name: '02-tablet', width: 768, height: 1024 },
  { name: '03-mobile', width: 390, height: 844 },
];

fs.mkdirSync(OUT, { recursive: true });

function extractToken(json) {
  const data = json?.data && typeof json.data === 'object' ? json.data : json;
  return (
    data?.accessToken
    || data?.access_token
    || data?.tokens?.accessToken
    || data?.tokens?.access_token
    || json?.accessToken
    || ''
  );
}

async function apiLogin() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const json = await res.json().catch(() => ({}));
  const accessToken = extractToken(json);
  const refreshToken = json?.data?.tokens?.refreshToken || json?.data?.refreshToken || '';
  const user = json?.data?.user || null;
  if (!accessToken || !refreshToken) {
    throw new Error(`API login failed: status=${res.status}`);
  }
  return { accessToken, refreshToken, user };
}

async function attachSession(page, auth) {
  await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(({ authState, email }) => {
    const now = Date.now();
    // initAuthStorage sırası: browser/tab bayrakları önce, sonra remember + token
    sessionStorage.setItem('meridyenBrowserSession', '1');
    sessionStorage.setItem('meridyenAuthTab', '1');
    sessionStorage.setItem('authSession', 'active');
    sessionStorage.setItem('accessToken', authState.accessToken);
    sessionStorage.setItem('refreshToken', authState.refreshToken);
    localStorage.setItem('meridyenRememberMe', '1');
    localStorage.setItem('authPersistence', 'remember');
    localStorage.setItem('accessToken', authState.accessToken);
    localStorage.setItem('refreshToken', authState.refreshToken);
    localStorage.setItem('tokenExpiry', String(now + 7 * 24 * 60 * 60 * 1000));
    localStorage.setItem('meridyenLastAuthActivity', String(now));
    localStorage.setItem('rememberedEmail', email);
    localStorage.setItem('panel-sidebar-collapsed', 'false');
    localStorage.setItem('app-theme', JSON.stringify({ mode: 'light' }));
    if (authState.user) localStorage.setItem('user', JSON.stringify(authState.user));
  }, { authState: auth, email: EMAIL });

  await page.goto(`${BASE}/panel`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  if (!/\/panel/.test(page.url())) {
    throw new Error(`Panel redirect failed: ${page.url()} (host mismatch? use localhost not 127.0.0.1)`);
  }
}

async function apiGet(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`GET ${url} failed: status=${res.status}`);
  }
  return json?.data ?? json;
}

async function resolveVendor(token) {
  if (VENDOR_ID) {
    const vendor = await apiGet(`${API}/vendors/${VENDOR_ID}`, token);
    return { vendor, source: 'env' };
  }

  const list = await apiGet(`${API}/vendors?limit=12&status=active`, token);
  const items = Array.isArray(list) ? list : (list?.data || []);
  if (!items.length) throw new Error('Vendor list empty');

  const candidates = [];
  for (const item of items.slice(0, 8)) {
    try {
      const [vendor, overview] = await Promise.all([
        apiGet(`${API}/vendors/${item.id}`, token),
        apiGet(`${API}/vendors/${item.id}/profile-overview`, token),
      ]);
      const score =
        (vendor?.contacts?.length || 0)
        + (vendor?.serviceAreas?.length || 0)
        + (vendor?.vendorWorkGroups?.length || 0)
        + (overview?.fileHistory?.length || 0)
        + (overview?.costSummary?.length || 0)
        + (overview?.whatsappHistory?.length || 0);
      candidates.push({ vendor, score });
    } catch {
      // continue
    }
  }

  if (!candidates.length) {
    const first = items[0];
    const vendor = await apiGet(`${API}/vendors/${first.id}`, token);
    return { vendor, source: 'list-first' };
  }

  candidates.sort((a, b) => b.score - a.score);
  return { vendor: candidates[0].vendor, source: 'ranked' };
}

async function evaluateOverview(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
    const has = (label) => text.includes(label);
    const financePanelsVisible =
      has('Dosya Bazlı Ödemeler')
      || has('Ödeme Ekstreleri')
      || has('Toplam Ekstre');

    return {
      url: location.href,
      title: document.querySelector('h1')?.textContent?.trim() || '',
      bodyPreview: text.slice(0, 240),
      hasGeneral: has('Genel Bilgiler'),
      hasOps: has('Operasyon Özeti'),
      hasCost: has('Maliyet Özeti'),
      hasQuality: has('Hizmet Kalitesi'),
      hasCoverage: has('Hizmet Kapsamı'),
      hasFiles: has('Dosya Geçmişi'),
      hasWhatsapp: has('WhatsApp Geçmişi'),
      hasDecision: has('Karar Özeti'),
      hasFinanceTab: has('Finans'),
      financePanelsVisible,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    };
  });
}

async function waitForOverview(page) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText || '';
      return text.includes('Genel Bilgiler') && text.includes('Operasyon Özeti');
    },
    { timeout: 45000 },
  ).catch(() => null);
  await page.waitForTimeout(800);
}

async function main() {
  const auth = await apiLogin();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  const failedAssets = [];
  page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 400 && (/_next\/static|\/panel\/tedarikciler/.test(url))) {
      failedAssets.push({ status: res.status(), url: url.slice(0, 180) });
    }
  });

  await attachSession(page, auth);
  const resolved = await resolveVendor(auth.accessToken);
  const vendorUrl = `${BASE}/panel/tedarikciler/${resolved.vendor.id}`;
  const viewportResults = [];
  let overall = true;

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(vendorUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForOverview(page);

    const checks = await evaluateOverview(page);
    const screenshotPath = path.join(OUT, `${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const pass =
      Boolean(checks.title)
      && checks.hasGeneral
      && checks.hasOps
      && checks.hasCost
      && checks.hasQuality
      && checks.hasCoverage
      && checks.hasFiles
      && checks.hasWhatsapp
      && checks.hasDecision
      && checks.hasFinanceTab
      && !checks.financePanelsVisible
      && (vp.name !== '03-mobile' || !checks.hScroll);

    overall = overall && pass;
    viewportResults.push({
      name: vp.name,
      width: vp.width,
      height: vp.height,
      screenshot: screenshotPath,
      status: pass ? 'PASS' : 'FAIL',
      checks,
    });
  }

  const evidence = {
    at: new Date().toISOString(),
    epic: 'EPIC-06-tedarikci-profili',
    base: BASE,
    api: API,
    vendorId: resolved.vendor.id,
    vendorName: resolved.vendor.name,
    vendorSource: resolved.source,
    overall: overall ? 'PASS' : 'FAIL',
    commit: false,
    diagnostics: {
      pageErrors: pageErrors.slice(0, 8),
      failedAssets: failedAssets.slice(0, 12),
    },
    viewports: viewportResults,
  };

  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));

  await browser.close();
  if (!overall) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
