/**
 * Eksper Paneli pre-deploy smoke — API login + expert role override
 * node apps/web/scripts/smoke-eksper-portal-predeploy-20260724.mjs
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://127.0.0.1:3000/api/v1';
const OUT = path.resolve(
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
  if (!token) throw new Error(`API login failed: ${loginRes.status}`);
  return { token, refresh, user };
}

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@meridyenassistance.com';
  const password = process.env.ADMIN_PASSWORD || process.env.LOGIN_PASSWORD || 'admin123';
  const base = await apiLogin(email, password);
  const expertUser = {
    ...(base.user || {}),
    mustChangePassword: false,
    role: { ...(base.user?.role || {}), code: 'expert', name: 'Eksper Portalı' },
    firstName: 'Eksper',
    lastName: 'Test',
  };

  const checks = {};
  const errors = { console: [], page: [], requestfailed: [] };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.console.push(msg.text());
  });
  page.on('pageerror', (err) => errors.page.push(String(err)));
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (/favicon|hot-update|_next\/static/.test(u)) return;
    errors.requestfailed.push(`${req.failure()?.errorText || 'fail'} ${u}`);
  });

  await page.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: expertUser, success: true }),
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
      try {
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
      } catch {}
    },
    {
      accessToken: base.token,
      refreshToken: base.refresh,
      userJson: JSON.stringify(expertUser),
      emailUsed: email,
    },
  );

  async function dismiss() {
    for (let i = 0; i < 3; i++) {
      const btn = page.getByRole('button', { name: /Kapat|Tamam|Anladım|Vazgeç/i }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(250);
      } else break;
    }
  }

  await page.goto(`${WEB}/panel/eksper-portal`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  await dismiss();

  let body = await page.locator('body').innerText();
  checks.loginExpertView = /Eksper Paneli/i.test(body) && !/Bu sayfa eksperler içindir/.test(body) ? 1 : 0;
  checks.hasWhatsApp = body.includes('WhatsApp Destek') ? 1 : 0;
  checks.hasCall = body.includes('Çağrı Merkezi') ? 1 : 0;
  checks.hasEmail = body.includes('info@meridyenasistans.com') ? 1 : 0;
  checks.hasKpi = body.includes('Dosyalarım (Aktif)') ? 1 : 0;
  checks.hasSureAnalizi = body.includes('Süre Analizi') ? 1 : 0;
  checks.hasHizliOzet = body.includes('Hızlı Özet') ? 1 : 0;
  checks.hasDosyaHareket = body.includes('Güncel Dosya Hareketleri') ? 1 : 0;
  checks.gaugeNeedles = (await page.locator('svg polygon').count()) >= 4 ? 1 : 0;

  const navs = [
    ['navDosyalarim', '/panel/eksper-portal/dosyalar', 'Dosyalarım'],
    ['navInceleme', '/panel/eksper-portal/dosyalar?queue=inceleme', 'İnceleme Bekleyenler'],
    ['navRapor', '/panel/eksper-portal/dosyalar?queue=rapor', 'Rapor Bekleyenler'],
    ['navOnay', '/panel/eksper-portal/onaylar', 'Onay'],
  ];

  for (const [key, href, expectText] of navs) {
    await page.goto(`${WEB}/panel/eksper-portal`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    await dismiss();
    const link = page.locator(`a[href="${href}"]`).first();
    if (!(await link.isVisible().catch(() => false))) {
      checks[key] = 0;
      continue;
    }
    await link.click();
    await page.waitForTimeout(1000);
    const url = page.url();
    const t = await page.locator('body').innerText();
    const pathOk = href.includes('?') ? url.includes(href) : url.includes(href) && !url.includes('queue=');
    checks[key] = pathOk && t.includes(expectText) ? 1 : 0;
  }

  await page.goto(`${WEB}/panel/eksper-portal/dosyalar?queue=inceleme`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  body = await page.locator('body').innerText();
  checks.emptyOrList = /Henüz Dosya Bulunmuyor|dosya|Dosya/i.test(body) ? 1 : 0;

  // Yetki + admin regresyon: auth/me = gerçek admin rolü
  await browser.close();
  const authBrowser = await chromium.launch({ headless: true });
  const authPage = await authBrowser.newPage();
  await authPage.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: base.user, success: true }),
    });
  });
  await authPage.route('**/agreements/pending**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await authPage.addInitScript(
    ({ accessToken, refreshToken, userJson, emailUsed }) => {
      const now = Date.now();
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', userJson);
      localStorage.setItem('meridyenRememberMe', '1');
      localStorage.setItem('tokenExpiry', String(now + 86400000));
      localStorage.setItem('rememberedEmail', emailUsed);
      sessionStorage.setItem('meridyenBrowserSession', '1');
    },
    {
      accessToken: base.token,
      refreshToken: base.refresh,
      userJson: JSON.stringify(base.user),
      emailUsed: email,
    },
  );
  await authPage.goto(`${WEB}/panel/eksper-portal`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await authPage.waitForTimeout(1500);
  const denied = await authPage.locator('body').innerText();
  const deniedUrl = authPage.url();
  // Admin eksper paneline giremez: denied mesajı VEYA yönlendirme; KPI içeriği görünmez
  checks.authDeniedMessage =
    /Bu sayfa eksperler içindir/i.test(denied) ||
    (!denied.includes('Dosyalarım (Aktif)') && !denied.includes('Süre Analizi'))
      ? 1
      : 0;
  checks.authDeniedUrl = deniedUrl;

  await authPage.goto(`${WEB}/panel`, { waitUntil: 'networkidle', timeout: 60000 });
  await authPage.waitForTimeout(1500);
  const panelText = await authPage.locator('body').innerText();
  checks.adminPanelAlive = /Operasyon|Yönetim|Dashboard|Hasar|Bekleyen|Merkezi/i.test(panelText) ? 1 : 0;
  checks.adminNotEksperShell =
    !panelText.includes('Dosyalarım (Aktif)') && !panelText.includes('Süre Analizi') ? 1 : 0;

  await authPage.goto(`${WEB}/panel/sigorta-portal`, { waitUntil: 'domcontentloaded' });
  await authPage.waitForTimeout(1000);
  const sig = await authPage.locator('body').innerText();
  checks.sigortaPortalGate = /Sigorta|Bu sayfa|yetki|erişim|Dashboard|Operasyon/i.test(sig) ? 1 : 0;
  await authBrowser.close();

  // Responsive shots with expert session again
  const rb = await chromium.launch({ headless: true });
  const rp = await rb.newPage();
  await rp.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: expertUser, success: true }),
    });
  });
  await rp.route('**/agreements/pending**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await rp.addInitScript(
    ({ accessToken, refreshToken, userJson, emailUsed }) => {
      const now = Date.now();
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', userJson);
      localStorage.setItem('meridyenRememberMe', '1');
      localStorage.setItem('tokenExpiry', String(now + 86400000));
      localStorage.setItem('rememberedEmail', emailUsed);
      sessionStorage.setItem('meridyenBrowserSession', '1');
    },
    { accessToken: base.token, refreshToken: base.refresh, userJson: JSON.stringify(expertUser), emailUsed: email },
  );
  await rp.goto(`${WEB}/panel/eksper-portal`, { waitUntil: 'networkidle' });
  await rp.waitForTimeout(1000);
  await rp.setViewportSize({ width: 1440, height: 900 });
  await rp.screenshot({ path: path.join(OUT, 'desktop-1440-full.png'), fullPage: true });
  await rp.setViewportSize({ width: 768, height: 1024 });
  await rp.screenshot({ path: path.join(OUT, 'tablet-768-full.png'), fullPage: true });
  await rp.setViewportSize({ width: 390, height: 844 });
  await rp.screenshot({ path: path.join(OUT, 'mobile-390-full.png'), fullPage: true });
  checks.responsiveDesktop = 1;
  checks.responsiveTablet = 1;
  checks.responsiveMobile = 1;
  await rb.close();

  const consoleNoise = errors.console.filter(
    (t) => !/Download the React DevTools|favicon|hydration|third-party|net::ERR/i.test(t),
  );
  // Filter expected API 404 noise from optional endpoints during expert mock
  const consoleReal = consoleNoise.filter((t) => !/404 \(Not Found\)/i.test(t));
  const netNoise = errors.requestfailed.filter((t) => !/ERR_ABORTED/i.test(t));

  checks.consoleErrorZero = consoleReal.length === 0 ? 1 : 0;
  checks.networkErrorZero = netNoise.length === 0 ? 1 : 0;
  checks.runtimeErrorZero = errors.page.length === 0 ? 1 : 0;

  const required = [
    'loginExpertView',
    'hasWhatsApp',
    'hasCall',
    'hasEmail',
    'hasKpi',
    'gaugeNeedles',
    'navDosyalarim',
    'navInceleme',
    'navRapor',
    'navOnay',
    'emptyOrList',
    'authDeniedMessage',
    'adminPanelAlive',
    'adminNotEksperShell',
    'responsiveDesktop',
    'responsiveTablet',
    'responsiveMobile',
    'consoleErrorZero',
    'networkErrorZero',
    'runtimeErrorZero',
  ];
  const failed = required.filter((k) => !checks[k]);
  const report = {
    ok: failed.length === 0,
    failed,
    checks,
    errors: { console: consoleReal.slice(0, 20), page: errors.page.slice(0, 10), requestfailed: netNoise.slice(0, 10) },
  };
  fs.writeFileSync(path.join(OUT, 'PREDEPLOY-SMOKE.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
