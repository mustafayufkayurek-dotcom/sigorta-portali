/**
 * EPIC-05 — WhatsApp zorunlu (İlk Bilgilendirme + Kapanış/Anket) 2026-07-18
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-whatsapp-zorunlu-20260718.mjs
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
  ROOT,
  'docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-whatsapp-zorunlu-20260718',
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
  const list = await fetch(`${API}/emergency/cases?limit=50`, { headers });
  const json = await list.json().catch(() => ({}));
  const items = json?.data?.items || json?.data || json?.items || [];
  const arr = Array.isArray(items) ? items : [];
  const open = arr.find(
    (c) => c?.id && c.status !== 'FATURALANDILDI' && c.status !== 'COZULDU' && c.status !== 'IPTAL',
  );
  if (open?.id) return { id: open.id, source: 'open-case', status: open.status };
  const byId = await fetch(`${API}/emergency/cases/${SEED_EMERGENCY_ID}`, { headers });
  if (byId.ok) {
    const body = await byId.json().catch(() => ({}));
    const data = body?.data || body;
    return { id: SEED_EMERGENCY_ID, source: 'seed-id', status: data?.status || null };
  }
  if (arr[0]?.id) return { id: arr[0].id, source: 'list-first', status: arr[0].status };
  return { id: SEED_EMERGENCY_ID, source: 'fallback', status: null };
}

async function seedFlow(page, caseId, patch) {
  await page.evaluate(({ id, patch }) => {
    const key = `emergency-acil-flow:${id}`;
    const base = {
      costConfirmed: true,
      approvalRequested: true,
      customerApproved: true,
      workStartPrepared: true,
      serviceCompleted: true,
      fileClosed: false,
      financeTransferred: false,
      closureEmailSent: false,
      insuredInitialWhatsAppSent: false,
      insuredClosureSurveyWhatsAppSent: false,
      detectedCostTl: 450,
      approvalDetected: false,
      history: [],
      vendorProcess: 'hizmet_tamamlandi',
      priceChangeLog: [],
      messageLog: [],
    };
    localStorage.setItem(key, JSON.stringify({ ...base, ...patch }));
  }, { id: caseId, patch });
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('shot', name);
  return file;
}

async function main() {
  const auth = await apiLogin();
  const resolved = await resolveCase(auth.token);
  const caseId = resolved.id;
  console.log('case', resolved);

  const chromeCandidates = [
    path.join(process.env.HOME || '', 'Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    path.join(process.env.HOME || '', 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
  ];
  const executablePath = chromeCandidates.find((p) => fs.existsSync(p));
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await injectAuth(page, auth);
  await seedFlow(page, caseId, {});

  await page.goto(`${BASE}/panel/acil-yardim/${caseId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 45000 });
  await page.waitForTimeout(900);

  // Seed assigned user phone into UI via evaluate if missing — preview still needs owner phone.
  // If guard blocks, inject a local owner phone override is not available; capture checklist + ops anyway.
  await page.locator('[data-testid="hizli-islemler"]').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, '01-ops-islemleri-iki-whatsapp.png');

  const opsInitial = page.locator('[data-testid="ops-ilk-bilgilendirme"]');
  const opsSurvey = page.locator('[data-testid="ops-kapanis-anket"]');
  const opsMeta = {
    initialState: await opsInitial.getAttribute('data-visual-state').catch(() => null),
    surveyState: await opsSurvey.getAttribute('data-visual-state').catch(() => null),
    initialLabel: (await opsInitial.innerText().catch(() => '')).trim(),
    surveyLabel: (await opsSurvey.innerText().catch(() => '')).trim(),
  };

  await page.locator('[data-testid="zorunlu-islemler"]').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, '02-kapanis-oncesi-zorunlu-whatsapp.png');

  const checklist = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-testid^="zorunlu-"]')]
      .filter((el) => el.getAttribute('data-testid')?.startsWith('zorunlu-') && el.tagName === 'LI')
      .map((el) => ({
        key: el.getAttribute('data-testid'),
        done: el.getAttribute('data-done'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      }));
    return items;
  });

  // Try initial message preview (may fail if owner phone missing)
  await opsInitial.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  const previewVisible = await page.locator('[data-testid="sigortali-mesaj-onizleme-modal"]').isVisible().catch(() => false);
  const guardVisible = await page.locator('[data-testid="whatsapp-sigortali-hata"]').isVisible().catch(() => false);
  if (previewVisible) {
    await shot(page, '03-ilk-bilgilendirme-onizleme.png');
    await page.locator('[data-testid="sigortali-mesaj-onayla"]').click();
    await page.waitForTimeout(600);
  } else if (guardVisible) {
    await page.locator('[data-testid="alt-sekme-whatsapp"]').click().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, '03-ilk-bilgilendirme-telefon-eksik.png');
  } else {
    await page.locator('[data-testid="alt-sekme-whatsapp"]').click().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, '03-whatsapp-sigortali-sekme.png');
  }

  // Seed both WhatsApp flags complete + reload for gate evidence
  await seedFlow(page, caseId, {
    insuredInitialWhatsAppSent: true,
    insuredClosureSurveyWhatsAppSent: true,
    closureEmailSent: true,
    messageLog: [
      { at: new Date().toISOString(), kind: 'insured_initial', text: 'Değerli Sigortalımız…' },
      { at: new Date().toISOString(), kind: 'insured_closure', text: 'Acil Yardım dosyanız tamamlanmıştır…' },
    ],
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 45000 });
  await page.waitForTimeout(800);
  await page.locator('[data-testid="hizli-islemler"]').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, '04-ops-whatsapp-tamam.png');
  await page.locator('[data-testid="zorunlu-islemler"]').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, '05-kapanis-whatsapp-tamam.png');

  const afterDone = {
    initialState: await page.locator('[data-testid="ops-ilk-bilgilendirme"]').getAttribute('data-visual-state').catch(() => null),
    surveyState: await page.locator('[data-testid="ops-kapanis-anket"]').getAttribute('data-visual-state').catch(() => null),
    checklist: await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="zorunlu-"]')]
        .filter((el) => el.tagName === 'LI')
        .map((el) => ({
          key: el.getAttribute('data-testid'),
          done: el.getAttribute('data-done'),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        })),
    ),
  };

  const evidence = {
    at: new Date().toISOString(),
    caseId,
    resolved,
    opsMeta,
    checklistBefore: checklist,
    afterDone,
    previewVisible,
    guardVisible,
    note:
      'Operasyon sırası: İlk Bilgilendirme → Onay Talebi → İşe Başlama → Hizmeti Tamamla → Kapanış/Anket → Dosyayı Kapat Ve Finansa Gönder. Manuel wa.me; otomatik yok.',
  };
  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  fs.writeFileSync(
    path.join(OUT, 'RAPOR.md'),
    [
      '# EPIC-05 — WhatsApp Zorunlu (2026-07-18)',
      '',
      '## Operasyon İşlemleri sırası',
      '',
      '1. **İlk Bilgilendirme** (erken — ihbar sonrası)',
      '2. Onay Talebi',
      '3. İşe Başlama',
      '4. Hizmeti Tamamla',
      '5. **Kapanış / Anket** (hizmet sonrası, kapanış kapısı öncesi)',
      '6. Dosyayı Kapat Ve Finansa Gönder',
      '',
      'Her iki WhatsApp adımı **manuel** (dosya sorumlusu tetikler). Otomatik gönderim yok.',
      'Kapanış Öncesi Kontroller’de de aynı iki madde zorunlu; tamamlanmadan kapat+finans pasif.',
      '',
      '## Kanıt',
      '',
      `- Dosya: \`${caseId}\``,
      `- Ops (önce): initial=${opsMeta.initialState}, survey=${opsMeta.surveyState}`,
      `- Ops (sonra): initial=${afterDone.initialState}, survey=${afterDone.surveyState}`,
      '',
    ].join('\n'),
  );

  await browser.close();
  console.log('OUT', OUT);
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
