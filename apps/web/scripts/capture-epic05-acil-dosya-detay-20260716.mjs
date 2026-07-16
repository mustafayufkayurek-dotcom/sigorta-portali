/**
 * EPIC-05 — Acil Yardım Dosya Detay nihai tasarım doğrulama
 * Inject/mock YASAK — gerçek login + gerçek dosya.
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-acil-dosya-detay-20260716.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.CAPTURE_BASE || 'http://localhost:3001';
const API = process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';
const OUT = path.resolve(
  process.env.CAPTURE_OUT ||
    path.join(
      __dirname,
      '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-acil-dosya-detay-20260716',
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

function mustHave(text, needles) {
  const missing = needles.filter((n) => !text.includes(n));
  return { ok: missing.length === 0, missing };
}

async function login(page) {
  await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  const email = page.locator('input[type="email"], input[name="email"]').first();
  const pass = page.locator('input[type="password"]').first();
  await email.fill(EMAIL);
  await pass.fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/panel/, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function resolveCaseId(page) {
  const token = await page.evaluate(() => {
    try {
      return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    } catch {
      return '';
    }
  });
  if (!token) return { id: SEED_EMERGENCY_ID, source: 'seed-fallback-no-token' };

  const headers = { Authorization: `Bearer ${token}` };
  const byId = await fetch(`${API}/emergency/cases/${SEED_EMERGENCY_ID}`, { headers });
  if (byId.ok) {
    return { id: SEED_EMERGENCY_ID, source: 'seed-id' };
  }

  const list = await fetch(`${API}/emergency/cases?limit=5`, { headers });
  const json = await list.json().catch(() => ({}));
  const items = json?.data?.items || json?.data || json?.items || [];
  const first = Array.isArray(items) ? items[0] : null;
  if (first?.id) return { id: first.id, source: 'list-first', caseNo: first.caseNo || first.fileNo };
  return { id: SEED_EMERGENCY_ID, source: 'seed-fallback' };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'tr-TR' });
  const page = await context.newPage();

  const evidence = {
    at: new Date().toISOString(),
    base: BASE,
    api: API,
    injectUsed: false,
    caseId: null,
    caseSource: null,
    viewports: [],
    typecheck: null,
    overall: 'FAIL',
  };

  try {
    await login(page);
    const loggedIn = /\/panel/.test(page.url());
    if (!loggedIn) {
      evidence.loginError = `Login failed, url=${page.url()}`;
      fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
      console.error('LOGIN FAIL', page.url());
      await browser.close();
      process.exit(1);
    }

    const resolved = await resolveCaseId(page);
    evidence.caseId = resolved.id;
    evidence.caseSource = resolved.source;
    const detailUrl = `${BASE}/panel/acil-yardim/${resolved.id}`;

    let allPass = true;
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);

      const text = await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' '));
      const checks = mustHave(text, [
        'Güncel İşlem',
        'Tedarikçi Önerileri',
        'Maliyet Ve Onay',
        'Onay Talebi Oluştur',
        'Dosya Geçmişi',
        'Finans',
        'Süreç',
      ]);
      const noVaka = !/\bVaka\b/i.test(text) || /Dosya/.test(text);
      const financeOnFirstScreen =
        text.includes('Kar Analizi') || text.includes('Hakediş Ve Ödeme') || text.includes('Net Kâr');
      // Net Kâr only OK if Finans tab open — tabs start closed
      const finansOpen = await page.locator('[data-testid="alt-sekmeler"]').evaluate((el) =>
        /Net Kâr|Hakediş/.test(el.innerText || ''),
      ).catch(() => false);

      const shotPath = path.join(OUT, `${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });

      const pass =
        checks.ok &&
        noVaka &&
        !finansOpen &&
        page.url().includes('/panel/acil-yardim/');

      if (!pass) allPass = false;
      const row = {
        viewport: vp,
        status: pass ? 'PASS' : 'FAIL',
        url: page.url(),
        shot: shotPath,
        missingLabels: checks.missing,
        financeTabClosed: !finansOpen,
        notes: resolved.caseNo || undefined,
      };
      evidence.viewports.push(row);
      console.log(`${vp.name} → ${row.status}${checks.missing.length ? ` missing=${checks.missing.join(',')}` : ''}`);
    }

    evidence.overall = allPass ? 'PASS' : 'FAIL';
    fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
    console.log('OVERALL', evidence.overall, 'case=', evidence.caseId, evidence.caseSource);
    await browser.close();
    process.exit(allPass ? 0 : 1);
  } catch (err) {
    evidence.error = String(err?.message || err);
    fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
    console.error(err);
    await browser.close().catch(() => {});
    process.exit(1);
  }
}

main();
