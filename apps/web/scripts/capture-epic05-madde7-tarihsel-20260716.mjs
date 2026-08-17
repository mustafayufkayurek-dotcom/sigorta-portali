/**
 * EPIC-05 Madde 7 — Tarihsel Dosya (yalnızca bu madde)
 * Inject/mock YASAK — gerçek login + AY-202606-0001.
 *
 *   CAPTURE_BASE=http://127.0.0.1:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-madde7-tarihsel-20260716.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.CAPTURE_BASE || 'http://localhost:3001';
const API = process.env.CAPTURE_API || 'http://localhost:3000/api/v1';
const OUT = path.resolve(
  process.env.CAPTURE_OUT ||
    path.join(
      __dirname,
      '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-madde7-tarihsel-20260716',
    ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';
const SEED_ID = process.env.EMERGENCY_CASE_ID || 'f4624c59-30e9-4380-8ac9-abb2f0c36757';
/** Cutoff: Europe/Istanbul midnight 2026-07-01 — web historical-file.ts ile aynı */
const HISTORICAL_CUTOFF = new Date('2026-07-01T00:00:00+03:00');

fs.mkdirSync(OUT, { recursive: true });

function passFail(ok, reason) {
  return { status: ok ? 'PASS' : 'FAIL', reason: ok ? null : reason };
}

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

async function login(page) {
  // 1) Gerçek API login (token + user)
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  const token = extractToken(loginJson);
  const refresh =
    loginJson?.data?.tokens?.refreshToken
    || loginJson?.data?.refreshToken
    || '';
  const user = loginJson?.data?.user || null;
  if (!token || !refresh) {
    throw new Error(`API login failed: status=${loginRes.status}`);
  }

  // 2) Beni Hatırla yolu (localStorage) — panel guard ile uyumlu
  await page.goto(`${BASE}/giris`, { waitUntil: 'networkidle', timeout: 60000 }).catch(async () => {
    await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  });
  await page.waitForTimeout(800);
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

  // Doğrula storage yazıldı
  const stored = await page.evaluate(() => ({
    access: Boolean(localStorage.getItem('accessToken')),
    refresh: Boolean(localStorage.getItem('refreshToken')),
    remember: localStorage.getItem('meridyenRememberMe'),
    persistence: localStorage.getItem('authPersistence'),
  }));
  if (!stored.access || !stored.refresh) {
    throw new Error(`Token storage failed: ${JSON.stringify(stored)}`);
  }

  await page.goto(`${BASE}/panel`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Hâlâ /giris ise UI form ile dene
  if (!/\/panel/.test(page.url())) {
    await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1000);
    const emailInput = page.locator('form input[type="email"], form input[name="email"]').first();
    const passInput = page.locator('form input[type="password"]').first();
    await emailInput.click({ clickCount: 3 });
    await emailInput.fill(EMAIL);
    await passInput.click({ clickCount: 3 });
    await passInput.fill(PASSWORD);
    // Beni Hatırla
    const remember = page.locator('form input[type="checkbox"]').first();
    if (await remember.count()) {
      const checked = await remember.isChecked().catch(() => false);
      if (!checked) await remember.check().catch(() => {});
    }
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForURL(/\/panel/, { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  return token;
}

async function resolveHistoricalCase(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const byId = await fetch(`${API}/emergency/cases/${SEED_ID}`, { headers });
  if (byId.ok) {
    const json = await byId.json().catch(() => ({}));
    const c = json?.data || json;
    const dateRaw = c?.createdAt || c?.fileDate;
    if (dateRaw && new Date(dateRaw) < HISTORICAL_CUTOFF) {
      return {
        id: c.id || SEED_ID,
        caseNo: c.caseNo || c.fileNo || 'AY-202606-0001',
        createdAt: c.createdAt,
        fileDate: c.fileDate,
        source: 'seed-id',
      };
    }
  }

  if (token) {
    const list = await fetch(`${API}/emergency/cases?limit=50`, { headers });
    if (list.ok) {
      const json = await list.json().catch(() => ({}));
      const items = json?.data?.items || json?.data || json?.items || [];
      if (Array.isArray(items)) {
        for (const item of items) {
          const dateRaw = item.createdAt || item.fileDate;
          if (!dateRaw) continue;
          const d = new Date(dateRaw);
          if (Number.isNaN(d.getTime())) continue;
          if (d < HISTORICAL_CUTOFF) {
            return {
              id: item.id,
              caseNo: item.caseNo || item.fileNo,
              createdAt: item.createdAt,
              fileDate: item.fileDate,
              source: 'list',
            };
          }
        }
      }
    }
  }

  return {
    id: SEED_ID,
    caseNo: 'AY-202606-0001',
    createdAt: null,
    fileDate: '2026-06-16T19:35:00.000Z',
    source: 'seed-fallback',
  };
}

async function main() {
  const evidence = {
    at: new Date().toISOString(),
    base: BASE,
    api: API,
    injectUsed: false,
    cutoff: '2026-07-01T00:00:00+03:00',
    case: null,
    madde7: null,
    shot: null,
    ui: null,
    loginOk: false,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    const token = await login(page);
    evidence.loginOk = /\/panel/.test(page.url());
    evidence.loginUrl = page.url();

    if (!evidence.loginOk) {
      evidence.madde7 = passFail(false, `Panel oturumu açılamadı, url=${page.url()}`);
      const failShot = path.join(OUT, '07-tarihsel-dosya.png');
      await page.screenshot({ path: failShot, fullPage: true });
      evidence.shot = failShot;
    } else {
      const historical = await resolveHistoricalCase(token);
      evidence.case = historical;

      await page.goto(`${BASE}/panel/acil-yardim/${historical.id}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(2500);

      const ui = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="acil-dosya-detay"]');
        const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ');
        const badge = document.querySelector('[data-testid="tarihsel-dosya-badge"]');
        const badgeText = (badge?.textContent || '').trim();
        const hasBadge = badgeText === 'Tarihsel Dosya' || /Tarihsel Dosya/.test(bodyText);
        const fakeBlockers = /Şema Bloklu|claimFile bağı|eksik finans|zorunlu yeni süreç|sahte bloker/i.test(bodyText);
        const missingCostWarn = /Eksik Maliyet|maliyet uyarısı|Tedarikçi Maliyeti Bekleniyor/i.test(bodyText);
        const missingApprovalWarn = /Eksik Onay|onay uyarısı|Asistans Onayı Bekleniyor/i.test(bodyText);
        const guncel = (document.querySelector('[data-testid="guncel-islem"]')?.innerText || '').replace(/\s+/g, ' ');
        const notFound = /Dosya bulunamadı/.test(bodyText);
        return {
          hasBadge,
          badgeText,
          fakeBlockers,
          missingCostWarn,
          missingApprovalWarn,
          guncel,
          bodySample: bodyText.slice(0, 500),
          rootPresent: Boolean(root),
          notFound,
        };
      });

      const shot = path.join(OUT, '07-tarihsel-dosya.png');
      await page.screenshot({ path: shot, fullPage: true });
      evidence.shot = shot;
      evidence.ui = ui;

      const ok =
        ui.rootPresent &&
        !ui.notFound &&
        ui.hasBadge &&
        !ui.fakeBlockers &&
        !ui.missingCostWarn &&
        !ui.missingApprovalWarn;

      evidence.madde7 = passFail(
        ok,
        ok
          ? null
          : `root=${ui.rootPresent} notFound=${ui.notFound} badge=${ui.hasBadge} fakeBlockers=${ui.fakeBlockers} costWarn=${ui.missingCostWarn} approvalWarn=${ui.missingApprovalWarn} guncel="${ui.guncel}"`,
      );
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  const line = `7. Tarihsel Dosya\n${evidence.madde7?.status || 'FAIL'}\n(kanıt: ${evidence.shot || 'yok'}; case=${evidence.case?.caseNo || 'yok'}; badge=${evidence.ui?.hasBadge}; reason=${evidence.madde7?.reason || 'ok'})`;
  fs.writeFileSync(path.join(OUT, 'RAPOR.txt'), line + '\n');
  console.log(line);
  if (evidence.madde7?.status === 'PASS') {
    console.log('\nEPIC-05 Local Ürün Kabulü Tamamlandı');
  }
  process.exit(evidence.madde7?.status === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
