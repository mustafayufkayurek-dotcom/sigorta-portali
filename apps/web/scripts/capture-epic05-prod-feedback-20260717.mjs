/**
 * EPIC-05 — Prod geri bildirim (telefon / matbu / Kaydet Ve Kapat)
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-prod-feedback-20260717.mjs
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
      'docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-prod-feedback-20260717',
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
  const byId = await fetch(`${API}/emergency/cases/${SEED_EMERGENCY_ID}`, { headers });
  if (byId.ok) {
    const j = await byId.json();
    const row = j?.data ?? j;
    if (row?.id) return row;
  }
  const list = await fetch(`${API}/emergency/cases?limit=20`, { headers });
  const lj = await list.json().catch(() => ({}));
  const rows = lj?.data?.items || lj?.data || lj?.items || [];
  const arr = Array.isArray(rows) ? rows : [];
  if (!arr.length) throw new Error('No emergency cases for capture');
  return arr[0];
}

function writeJson(name, obj) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 2));
}

async function main() {
  const auth = await apiLogin();
  const caseRow = await resolveCase(auth.token);
  const caseId = caseRow.id;
  const evidence = {
    at: new Date().toISOString(),
    caseId,
    caseNo: caseRow.caseNo ?? null,
    checks: {},
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await injectAuth(page, auth);

  // ── 1) Dosya Bütçesi — Kaydet Ve Kapat ───────────────────────────────────
  await page.goto(`${BASE}/panel/acil-yardim/${caseId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForSelector('[data-testid="fiyat-giris"]', { timeout: 45000 });
  const saveClose = page.locator('[data-testid="fiyat-kaydet-ve-kapat"]');
  await saveClose.waitFor({ state: 'visible', timeout: 15000 });
  await saveClose.scrollIntoViewIfNeeded();
  await page.locator('[data-testid="fiyat-giris"]').screenshot({
    path: path.join(OUT, 'butce-kaydet-ve-kapat.png'),
  });
  const saveBox = await saveClose.boundingBox();
  evidence.checks.kaydetVeKapat = {
    visible: await saveClose.isVisible(),
    text: ((await saveClose.textContent()) || '').trim(),
    y: saveBox?.y ?? null,
  };

  // ── 2) Google Alternatifleri — telefon ───────────────────────────────────
  const altTab = page.locator('[data-testid="sekme-alternatif-oneriler"]');
  await altTab.waitFor({ state: 'visible', timeout: 15000 });
  await altTab.click();
  await page.waitForTimeout(1500);
  const refreshBtn = page
    .locator('[data-testid="alternatif-tedarikci-panel"] button')
    .filter({ hasText: /Yenile|Ara/ })
    .first();
  if (await refreshBtn.count()) {
    await refreshBtn.click();
    await page.waitForTimeout(8000);
  } else {
    await page.waitForTimeout(5000);
  }
  const altPanel = page.locator('[data-testid="sekme-alternatif-icerik"]');
  await altPanel.screenshot({ path: path.join(OUT, 'google-with-phone.png') });
  const phones = await page.locator('[data-testid="alternatif-aday"]').evaluateAll((nodes) =>
    nodes.map((n) => ({
      name: (n.querySelector('h3, .font-semibold, [data-testid="vendor-candidate-name"]')?.textContent || '').trim(),
      hasMissingLabel: (n.textContent || '').includes('Telefon Bilgisi Bulunamadı'),
      textSample: (n.textContent || '').replace(/\s+/g, ' ').slice(0, 160),
    })),
  );
  evidence.checks.googleAlternatif = {
    candidateCount: phones.length,
    phones,
    allHavePhone: phones.length === 0 || phones.every((p) => !p.hasMissingLabel),
  };

  // ── 3) Matbu — yeni oluştur + logo ───────────────────────────────────────
  const headers = {
    Authorization: `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
  };
  const createRes = await fetch(`${API}/file-documents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      entityType: 'emergency_case',
      entityId: caseId,
      documentKind: 'matbu_evrak',
    }),
  });
  const createJson = await createRes.json().catch(() => ({}));
  const doc = createJson?.data ?? createJson;
  const token = doc?.publicToken;
  evidence.checks.matbuCreate = {
    status: createRes.status,
    id: doc?.id ?? null,
    hasToken: Boolean(token),
  };

  if (token) {
    await page.goto(`${BASE}/evrak/${token}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(OUT, 'matbu-logo-fixed.png'),
      fullPage: true,
    });
    const matbuMeta = await page.evaluate(() => {
      const root = document.querySelector('.evrak-document-root') || document.body;
      const img = root.querySelector('img');
      const text = root.textContent || '';
      return {
        logoSrc: img?.getAttribute('src') || null,
        logoNaturalWidth: img?.naturalWidth ?? 0,
        logoComplete: img?.complete ?? false,
        hasAlisLeak: /Alış Fiyat|Satış Fiyat|Tedarikçi Alış/i.test(text),
        hasIsOzetiPlaceholder: /İş özeti girilmemiş/i.test(text),
        snippet: text.replace(/\s+/g, ' ').slice(0, 400),
      };
    });
    evidence.checks.matbu = matbuMeta;
  }

  writeJson('EVIDENCE.json', evidence);
  await browser.close();
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`OUT=${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
