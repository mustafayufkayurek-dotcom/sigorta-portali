/**
 * EPIC-05 — Belgeler üst boşluk (Operasyon/Zorunlu → sekmeler sıkı aralık)
 *
 *   CAPTURE_BASE=http://localhost:3011 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-belgeler-ust-bosluk-20260717.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE = process.env.CAPTURE_BASE || 'http://localhost:3011';
const API = process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';
const OUT = path.resolve(
  process.env.CAPTURE_OUT ||
    path.join(
      ROOT,
      'docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-belgeler-ust-bosluk-20260717',
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
  // Token'ları her navigasyondan ÖNCE enjekte et — AuthStorageInit temizlemesin
  await page.addInitScript(
    ({ accessToken, refreshToken, userJson, email }) => {
      const now = Date.now();
      try {
        sessionStorage.setItem('meridyenBrowserSession', '1');
        sessionStorage.setItem('meridyenAuthTab', '1');
        sessionStorage.setItem('accessToken', accessToken);
        sessionStorage.setItem('refreshToken', refreshToken);
        sessionStorage.setItem('authSession', 'active');
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('meridyenRememberMe', '1');
        localStorage.setItem('authPersistence', 'remember');
        localStorage.setItem('tokenExpiry', String(now + 7 * 24 * 60 * 60 * 1000));
        localStorage.setItem('meridyenLastAuthActivity', String(now));
        localStorage.setItem('rememberedEmail', email);
        if (userJson) localStorage.setItem('user', userJson);
      } catch (_) {
        /* ignore */
      }
    },
    {
      accessToken: token,
      refreshToken: refresh,
      userJson: user ? JSON.stringify(user) : '',
      email: EMAIL,
    },
  );
  await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(300);
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
  try {
    await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 45000 });
  } catch (err) {
    const failPath = path.join(OUT, '00-login-fail.png');
    await page.screenshot({ path: failPath, fullPage: true }).catch(() => {});
    const debug = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      hasToken: Boolean(localStorage.getItem('accessToken')),
      hasSession: Boolean(sessionStorage.getItem('meridyenBrowserSession')),
      bodyText: (document.body?.innerText || '').slice(0, 500),
    }));
    fs.writeFileSync(path.join(OUT, '00-login-fail.json'), `${JSON.stringify(debug, null, 2)}\n`);
    throw err;
  }
  await page.waitForSelector('[data-testid="operasyon-iki-kolon"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="alt-operasyon"]', { timeout: 15000 });
  await page.waitForTimeout(1200);

  const altTab = page.locator('[data-testid="sekme-alternatif-oneriler"]');
  if (await altTab.count()) {
    await altTab.click();
    await page.waitForTimeout(600);
  }

  await page.locator('[data-testid="alt-sekme-belgeler"]').click().catch(() => {});
  await page.waitForTimeout(400);

  const metrics = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="operasyon-iki-kolon"]');
    const ops = document.querySelector('[data-testid="hizli-islemler"]');
    const zorunlu = document.querySelector('[data-testid="zorunlu-islemler"]');
    const vendor = document.querySelector('[data-testid="tedarikci-onerileri"]');
    const budget = document.querySelector('[data-testid="fiyat-giris"]');
    const tabs = document.querySelector('[data-testid="alt-operasyon"]');
    const tablist = document.querySelector('[data-testid="alt-bolum-sekmeler"]');
    const docsTitle = document.querySelector('[data-testid="dosya-belgeleri"]');

    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const gridR = rect(grid);
    const opsR = rect(ops);
    const zorR = rect(zorunlu);
    const vendorR = rect(vendor);
    const budgetR = rect(budget);
    const tabsR = rect(tabs);
    const tablistR = rect(tablist);
    const docsR = rect(docsTitle);

    const bottomOfUpper = Math.max(opsR?.bottom ?? 0, zorR?.bottom ?? 0, gridR?.bottom ?? 0);
    const gapUpperToTabs = tabsR ? Math.max(0, tabsR.top - bottomOfUpper) : null;
    const gapOpsToTabs = opsR && tabsR ? Math.max(0, tabsR.top - opsR.bottom) : null;
    const gapZorunluToTabs = zorR && tabsR ? Math.max(0, tabsR.top - zorR.bottom) : null;
    const opsAlignedWithZorunlu =
      opsR && zorR ? Math.abs(opsR.top - zorR.top) < 48 : false;
    const opsBottomAlignedWithZorunlu =
      opsR && zorR ? Math.abs(opsR.bottom - zorR.bottom) < 12 : false;
    const opsHeight = opsR ? opsR.height : null;
    const opsCards = document.querySelector('[data-testid="hizli-islem-kartlari"]');
    const cardsH = opsCards ? opsCards.getBoundingClientRect().height : null;
    const opsInternalVoid =
      opsHeight != null && cardsH != null ? Math.max(0, opsHeight - cardsH - 40) : null;

    return {
      gapUpperToTabs: gapUpperToTabs != null ? Math.round(gapUpperToTabs) : null,
      gapOpsToTabs: gapOpsToTabs != null ? Math.round(gapOpsToTabs) : null,
      gapZorunluToTabs: gapZorunluToTabs != null ? Math.round(gapZorunluToTabs) : null,
      opsAlignedWithZorunlu,
      opsBottomAlignedWithZorunlu,
      opsHeight: opsHeight != null ? Math.round(opsHeight) : null,
      opsInternalVoid: opsInternalVoid != null ? Math.round(opsInternalVoid) : null,
      vendorBelowBudgetDelta:
        vendorR && budgetR ? Math.round(budgetR.height - vendorR.height) : null,
      tablistToDocsTitle:
        tablistR && docsR ? Math.round(Math.max(0, docsR.top - tablistR.bottom)) : null,
      layout2x2: Boolean(
        opsR && zorR && vendorR && budgetR
        && Math.abs(opsR.left - vendorR.left) < 40
        && Math.abs(zorR.left - budgetR.left) < 40
        && opsR.top > vendorR.bottom - 8
        && zorR.top > budgetR.bottom - 8,
      ),
    };
  });

  const shotPath = path.join(OUT, '01-desktop.png');
  // Üst blok altı + sekmeler — scroll ile ortala değil, grid+tabs birlikte görünsün
  await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="operasyon-iki-kolon"]');
    if (grid) grid.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(200);
  const clip = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="operasyon-iki-kolon"]');
    const tabs = document.querySelector('[data-testid="alt-operasyon"]');
    if (!grid || !tabs) return null;
    const g = grid.getBoundingClientRect();
    const t = tabs.getBoundingClientRect();
    const top = Math.max(0, g.top);
    const bottom = Math.min(window.innerHeight, t.top + 120);
    return {
      x: Math.max(0, Math.min(g.left, t.left) - 8),
      y: top,
      width: Math.min(window.innerWidth, Math.max(g.right, t.right) + 8) - Math.max(0, Math.min(g.left, t.left) - 8),
      height: Math.max(80, bottom - top),
    };
  });
  if (clip) {
    await page.screenshot({ path: shotPath, clip });
  } else {
    await page.screenshot({ path: shotPath, fullPage: false });
  }

  const fullPath = path.join(OUT, '01-tam-sayfa-desktop.png');
  await page.screenshot({ path: fullPath, fullPage: true });

  // Tam genişlik boşluk = max(ops, zorunlu) altı → sekmeler. Ops self-end ile alta yaslı.
  const pass =
    metrics.gapUpperToTabs != null
    && metrics.gapUpperToTabs <= 16
    && metrics.gapOpsToTabs != null
    && metrics.gapOpsToTabs <= 16
    && metrics.gapZorunluToTabs != null
    && metrics.gapZorunluToTabs <= 16
    && metrics.opsBottomAlignedWithZorunlu === true
    && (metrics.opsInternalVoid == null || metrics.opsInternalVoid <= 24)
    && metrics.layout2x2 === true;

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    caseInfo,
    shotPath,
    fullPath,
    metrics,
    pass,
    target: 'gapUpperToTabs <= 16px (enterprise 8–12px ideal)',
  };

  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(
    path.join(OUT, 'RAPOR.md'),
    [
      '# EPIC-05 — Belgeler Üst Boşluk',
      '',
      `**Tarih:** 2026-07-17`,
      `**Ortam:** Local (\`${BASE}\`)`,
      '**Deploy / Commit:** Yok',
      '',
      '## Ölçüm',
      '',
      `| Metrik | Değer | Hedef |`,
      `|--------|-------|-------|`,
      `| gapUpperToTabs (üst blok → sekmeler) | **${metrics.gapUpperToTabs}px** | ≤ 16px |`,
      `| gapOpsToTabs | ${metrics.gapOpsToTabs}px | ≤ 16px |`,
      `| gapZorunluToTabs | ${metrics.gapZorunluToTabs}px | ≤ 16px |`,
      `| opsAlignedWithZorunlu (üst) | ${metrics.opsAlignedWithZorunlu} | — |`,
      `| opsBottomAlignedWithZorunlu | ${metrics.opsBottomAlignedWithZorunlu} | true |`,
      `| opsInternalVoid | ${metrics.opsInternalVoid}px | ≤ 24px |`,
      `| layout2x2 | ${metrics.layout2x2} | true |`,
      '',
      `**Sonuç:** ${pass ? 'PASS' : 'FAIL'}`,
      '',
      '## Ne değişti',
      '',
      '1. İki kolon yığını yerine **2×2 grid** — Operasyon ile Zorunlu aynı satırda.',
      '2. Operasyon `self-end` — satır altında Zorunlu ile hizalı; sekmeler üstüne sol boşluk yok.',
      '3. Operasyon kartı `h-fit` — içerik yüksekliği; kart içi beyaz okyanus yok.',
      '4. Üst blok → Belgeler sekmeleri arası **8px**.',
      '5. `Bağlı E-posta Yok` kompakt empty state.',
      '',
      '## Kanıt',
      '',
      '- `01-desktop.png`',
      '- `01-tam-sayfa-desktop.png`',
      '- `EVIDENCE.json`',
      '',
    ].join('\n'),
  );

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
