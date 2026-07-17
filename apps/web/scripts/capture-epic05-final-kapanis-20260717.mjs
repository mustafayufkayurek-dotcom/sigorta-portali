/**
 * EPIC-05 FINAL KAPANIS — responsive ispat (desktop / tablet / mobile)
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-final-kapanis-20260717.mjs
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
      'docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-final-kapanis-20260717',
    ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';
const SEED_EMERGENCY_ID = process.env.EMERGENCY_CASE_ID || 'f4624c59-30e9-4380-8ac9-abb2f0c36757';

fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: '01-desktop', width: 1440, height: 900 },
  { name: '02-tablet', width: 768, height: 1024 },
  { name: '03-mobile', width: 390, height: 844 },
];

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
  const byId = await fetch(`${API}/emergency/cases/${SEED_EMERGENCY_ID}`, { headers });
  if (byId.ok) return { id: SEED_EMERGENCY_ID, source: 'seed-id' };
  const list = await fetch(`${API}/emergency/cases?limit=20`, { headers });
  const json = await list.json().catch(() => ({}));
  const items = json?.data?.items || json?.data || json?.items || [];
  const first = Array.isArray(items) ? items[0] : null;
  if (first?.id) return { id: first.id, source: 'list-first' };
  return { id: SEED_EMERGENCY_ID, source: 'fallback' };
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth || 0);
    const clientWidth = doc.clientWidth || window.innerWidth;
    const hasHScroll = Math.ceil(scrollWidth) > Math.ceil(clientWidth) + 2;

    const root =
      document.querySelector('[data-testid="acil-dosya-detay"]') ||
      document.querySelector('main') ||
      body;

    // Üst seviye bölümler stacked mi? (mobil tek kolon)
    const sections = [...root.querySelectorAll(':scope > *')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 40 && r.width > 0;
    });
    const tops = sections.map((el) => Math.round(el.getBoundingClientRect().top));
    const stacked = tops.length <= 1 || new Set(tops).size >= Math.min(3, tops.length);

    // Touch: yalnızca dosya detay sayfası CTA'ları (panel chrome hariç)
    const pageButtons = [...root.querySelectorAll('button, a[role="button"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        const label = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48);
        const iconOnly = !label || label.length <= 2;
        const ok = iconOnly
          ? r.width >= 32 && r.height >= 32
          : r.height >= 36 || r.width >= 120;
        return {
          label,
          w: Math.round(r.width),
          h: Math.round(r.height),
          iconOnly,
          ok,
        };
      });
    const primary = pageButtons.filter((b) => !b.iconOnly);
    const touchFail = pageButtons.filter((b) => !b.ok);
    const primaryFail = primary.filter((b) => !b.ok);

    const consoleForbidden = /Google Maps|Places API|Operasyon Hafızası|Akıllı Tedarikçi/i.test(
      body?.innerText || '',
    );

    return {
      url: location.href,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      scrollWidth,
      clientWidth,
      hasHScroll,
      mainCols: { childCount: sections.length, stacked, tops: tops.slice(0, 8) },
      singleColLikely: stacked,
      pageButtonCount: pageButtons.length,
      primarySample: primary.slice(0, 12),
      touchFailCount: touchFail.length,
      primaryFailCount: primaryFail.length,
      touchFailSample: touchFail.slice(0, 8),
      forbiddenUiText: consoleForbidden,
      title: document.title,
    };
  });
}

async function main() {
  const auth = await apiLogin();
  const resolved = await resolveCase(auth.token);
  console.log('case', resolved);

  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const pageErrors = [];
  const results = [];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ viewport: vp.name, text: msg.text() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push({ viewport: vp.name, text: String(err?.message || err) });
    });

    await injectAuth(page, auth);
    await page.goto(`${BASE}/panel/acil-yardim/${resolved.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(2500);
    await page.waitForSelector('body', { timeout: 15000 });

    const metrics = await pageMetrics(page);
    const shotPath = path.join(OUT, `${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    const isMobile = vp.width <= 500;
    const overflowPass = !metrics.hasHScroll;
    const singleColPass = !isMobile || metrics.mainCols.stacked || metrics.singleColLikely;
    // Sayfa CTA: primary metin butonları geçmeli; ikon-only için sınırlı tolerans
    const touchPass = (metrics.primaryFailCount || 0) === 0 && (metrics.touchFailCount || 0) <= 2;

    results.push({
      viewport: vp.name,
      size: `${vp.width}x${vp.height}`,
      shot: shotPath,
      overflowPass,
      singleColPass,
      touchPass,
      metrics,
    });

    console.log(
      vp.name,
      overflowPass ? 'overflow=PASS' : 'overflow=FAIL',
      singleColPass ? 'col=PASS' : 'col=FAIL',
      touchPass ? 'touch=PASS' : 'touch=FAIL',
    );
    await page.close();
  }

  await browser.close();

  const allPass = results.every((r) => r.overflowPass && r.singleColPass && r.touchPass);
  const filteredConsole = consoleErrors.filter(
    (e) =>
      !/favicon|Download the React DevTools|hydration|third-party|net::ERR_/i.test(e.text),
  );

  const rapor = `# EPIC-05 Final Kapanış — Responsive Doğrulama

**Tarih:** ${new Date().toISOString()}
**Base:** ${BASE}
**Case:** ${resolved.id} (${resolved.source})
**Sonuç:** ${allPass ? 'PASS' : 'FAIL'}

## Viewport özeti

| Viewport | Overflow | Tek kolon (mobil) | Touch | Dosya |
|----------|----------|-------------------|-------|-------|
${results
  .map(
    (r) =>
      `| ${r.viewport} (${r.size}) | ${r.overflowPass ? 'PASS' : 'FAIL'} | ${r.singleColPass ? 'PASS' : 'FAIL'} | ${r.touchPass ? 'PASS' : 'FAIL'} | ${path.basename(r.shot)} |`,
  )
  .join('\n')}

## Notlar

- Yatay overflow: tüm viewport'larda \`document.scrollWidth <= clientWidth + 2\` kontrolü.
- Mobil tek kolon: \`[data-testid="acil-dosya-detay"]\` üst bölümleri stacked.
- Touch hedefleri: panel chrome hariç sayfa CTA (metin buton ≥36px / geniş CTA; ikon-only ≥32px).
- Console error (filtrelenmiş): ${filteredConsole.length}
- Page error: ${pageErrors.length}
- Yasaklı UI metin (Google/Hafıza/Akıllı): ${results.some((r) => r.metrics.forbiddenUiText) ? 'VAR' : 'YOK'}

### Console errors (ham, max 20)

\`\`\`json
${JSON.stringify(filteredConsole.slice(0, 20), null, 2)}
\`\`\`

### Page errors

\`\`\`json
${JSON.stringify(pageErrors.slice(0, 20), null, 2)}
\`\`\`

### Metrik detay

\`\`\`json
${JSON.stringify(
  results.map((r) => ({
    viewport: r.viewport,
    hasHScroll: r.metrics.hasHScroll,
    scrollWidth: r.metrics.scrollWidth,
    clientWidth: r.metrics.clientWidth,
    mainCols: r.metrics.mainCols,
    touchFailCount: r.metrics.touchFailCount,
    touchFailSample: r.metrics.touchFailSample,
  })),
  null,
  2,
)}
\`\`\`

## Komutlar

\`\`\`bash
CAPTURE_BASE=${BASE} CAPTURE_API=${API} node apps/web/scripts/capture-epic05-final-kapanis-20260717.mjs
\`\`\`
`;

  fs.writeFileSync(path.join(OUT, 'RAPOR.md'), rapor);
  fs.writeFileSync(
    path.join(OUT, 'EVIDENCE.json'),
    JSON.stringify({ allPass, resolved, results, consoleErrors: filteredConsole, pageErrors }, null, 2),
  );

  console.log('OUT', OUT);
  console.log('ALL', allPass ? 'PASS' : 'FAIL');
  if (!allPass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
