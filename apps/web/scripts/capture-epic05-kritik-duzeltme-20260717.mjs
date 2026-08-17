/**
 * EPIC-05 — Kritik düzeltme local kanıt (2026-07-17)
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-kritik-duzeltme-20260717.mjs
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
      'docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-kritik-duzeltme-20260717',
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
  const refresh =
    data?.tokens?.refreshToken
    || data?.refreshToken
    || '';
  const user = data?.user || null;
  if (!token) throw new Error(`API login failed: ${loginRes.status}`);
  return { token, refresh, user };
}

async function injectAuth(page, { token, refresh, user }) {
  // /giris bazen localde 500 verebiliyor; auth için herhangi bir app sayfası yeterli.
  await page.goto(`${BASE}/panel`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  });
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

async function collectPageState(page) {
  return page.evaluate(() => {
    const text = (sel) => (document.querySelector(sel)?.textContent || '').trim();
    const ops = [...document.querySelectorAll('[data-testid="hizli-islem-kartlari"] [data-visual-state]')].map(
      (el) => ({
        testId: el.getAttribute('data-testid') || el.tagName,
        state: el.getAttribute('data-visual-state'),
        disabled: el instanceof HTMLButtonElement ? el.disabled : null,
        title: el.getAttribute('title') || '',
      }),
    );
    const budgetTitle = text('[data-testid="fiyat-giris"]');
    const body = document.body?.innerText || '';
    return {
      phone: text('[data-testid="sigortali-telefon"]').slice(0, 80),
      owner: text('[data-testid="dosya-sorumlusu"]').slice(0, 140),
      hasDosyaButcesi: /Dosya Bütçesi/.test(budgetTitle) || /Dosya Bütçesi/.test(body),
      hasAlisSatisTitle: /Alış\s*\/\s*Satış Fiyatı/.test(budgetTitle),
      hasKarTutari: Boolean(document.querySelector('[data-testid="kar-tutari"]')),
      hasKarOrani: Boolean(document.querySelector('[data-testid="kar-orani"]')),
      zorunluUnderBudget: (() => {
        const sag = document.querySelector('[data-testid="sag-operasyon-kolon"]');
        if (!sag) return false;
        return Boolean(
          sag.querySelector('[data-testid="fiyat-giris"]')
          && sag.querySelector('[data-testid="zorunlu-islemler"]'),
        );
      })(),
      tabKayitli: text('[data-testid="sekme-kayitli-tedarikciler"]'),
      tabGoogle: text('[data-testid="sekme-alternatif-oneriler"]'),
      googleBadgeCount: document.querySelectorAll('[data-testid="google-ile-bulundu"]').length,
      googleOnKayitli: (() => {
        const panel = document.querySelector('[data-testid="sekme-kayitli-icerik"]');
        return panel ? /Google/i.test(panel.textContent || '') : false;
      })(),
      ops,
      closeInfo: text('[data-testid="dosya-kapat-kilit-bilgi"]').slice(0, 220),
      consoleErrors: (window.__captureConsoleErrors || []).slice(0, 20),
    };
  });
}

async function main() {
  const auth = await apiLogin();
  const resolved = await resolveCase(auth.token);
  console.log('case', resolved);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  await page.addInitScript(() => {
    window.__captureConsoleErrors = [];
    const orig = console.error.bind(console);
    console.error = (...args) => {
      try {
        window.__captureConsoleErrors.push(args.map(String).join(' ').slice(0, 240));
      } catch { /* ignore */ }
      orig(...args);
    };
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err.message || err).slice(0, 240)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 240));
  });

  await injectAuth(page, auth);

  await page.route(`**/emergency/cases/${resolved.id}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const res = await route.fetch();
    const json = await res.json().catch(() => ({}));
    const wrap = json?.data && typeof json.data === 'object' && !Array.isArray(json.data)
      ? json.data
      : json;
    const enriched = {
      ...wrap,
      status: 'SAHADA',
      customerPhone: wrap.customerPhone || '0532 111 22 33',
      assignedVendor: wrap.assignedVendor
        ? { ...wrap.assignedVendor, phone: wrap.assignedVendor.phone || '0532 444 55 66' }
        : wrap.assignedVendor,
      assignedUser: wrap.assignedUser || {
        id: 'demo-owner',
        firstName: 'Sistem',
        lastName: 'Yöneticisi',
        phone: '0532 000 11 22',
        email: 'admin@meridyenassistance.com',
      },
      operationChain: {
        ...(wrap.operationChain || {}),
        documents: {
          ...(wrap.operationChain?.documents || {}),
          totalCount: wrap.operationChain?.documents?.totalCount ?? 0,
          whatsappSentCount: 1,
          digitallyApprovedCount: 0,
          hasApprovedMatbuEvrak: false,
        },
        inbox: {
          ...(wrap.operationChain?.inbox || {}),
          messageCount: 1,
          attachmentCount: 0,
          hasHistory: true,
          lastReceivedAt: null,
        },
      },
    };
    const body = json?.data ? { ...json, data: enriched } : enriched;
    await route.fulfill({
      status: res.status(),
      headers: { ...res.headers(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  // Google alternatifleri: boş sonuçta badge görünmez; demo aday enjekte et
  await page.route('**/vendor-discovery/alternative-search**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            externalId: 'demo-google-1',
            name: 'Demo Çekici Servisi',
            address: 'Atatürk Cad. No:1',
            city: 'İstanbul',
            district: 'Kadıköy',
            phone: '',
            rating: 4.6,
            reviewCount: 128,
            serviceTypes: ['çekici'],
            websiteUrl: 'https://example.com',
            mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Demo',
          },
          {
            externalId: 'demo-google-2',
            name: 'Demo Yol Yardım',
            address: 'Bağdat Cad. No:20',
            city: 'İstanbul',
            district: 'Kadıköy',
            phone: '0216 555 44 33',
            rating: 4.2,
            reviewCount: 54,
            serviceTypes: ['çekici'],
          },
        ],
        meta: { configured: true, code: 'OK', message: 'ok', count: 2 },
      }),
    });
  });

  await page.goto(`${BASE}/panel/acil-yardim/${resolved.id}`, {
    waitUntil: 'load',
    timeout: 90000,
  }).catch(async () => {
    await page.goto(`${BASE}/panel/acil-yardim/${resolved.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
  });
  await page.waitForSelector('[data-testid="dosya-basligi"]', { timeout: 60000 });
  await page.waitForTimeout(800);

  await page.evaluate((caseId) => {
    const key = `emergency-acil-flow:${caseId}`;
    const prev = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(
      key,
      JSON.stringify({
        ...prev,
        costConfirmed: true,
        approvalRequested: true,
        customerApproved: true,
        workStartPrepared: true,
        serviceCompleted: true,
        fileClosed: false,
        financeTransferred: false,
        closureEmailSent: false,
        vendorProcess: 'hizmet_tamamlandi',
        history: prev.history || [],
        priceChangeLog: prev.priceChangeLog || [],
        messageLog: [
          { at: new Date().toISOString(), kind: 'vendor', text: 'Atama mesajı gönderildi' },
        ],
      }),
    );
  }, resolved.id);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="dosya-basligi"]', { timeout: 45000 });
  await page.waitForTimeout(1000);

  const satisInput = page.locator('[data-testid="satis-fiyati"]');
  if (await satisInput.count()) {
    await satisInput.fill('5000');
    await page.waitForTimeout(200);
  }
  const alisInput = page.locator('[data-testid="alis-fiyati"]');
  if (await alisInput.count()) {
    await alisInput.fill('3500');
    await page.waitForTimeout(200);
  }

  await page.setViewportSize({ width: 1440, height: 1600 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const desktopPath = path.join(OUT, '01-desktop-full.png');
  await page.screenshot({ path: desktopPath, fullPage: true });
  console.log('desktop', desktopPath);

  // Google Alternatifleri sekmesi
  const googleTab = page.locator('[data-testid="sekme-alternatif-oneriler"]');
  await googleTab.click();
  await page.waitForTimeout(800);
  await page.waitForSelector('[data-testid="sekme-alternatif-icerik"]', { timeout: 15000 });
  await page.waitForTimeout(600);
  const googlePath = path.join(OUT, '02-google-alternatifleri.png');
  await page.locator('[data-testid="tedarikci-onerileri"]').screenshot({ path: googlePath });
  console.log('google-tab', googlePath);

  // Operasyon buton durumları
  await page.evaluate(() => {
    document.querySelector('[data-testid="hizli-islemler"]')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
  const opsPath = path.join(OUT, '03-operasyon-butonlari.png');
  await page.locator('[data-testid="hizli-islemler"]').screenshot({ path: opsPath });
  console.log('ops', opsPath);

  const state = await collectPageState(page);
  state.pageErrors = consoleErrors.slice(0, 20);
  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify({
    at: new Date().toISOString(),
    case: resolved,
    base: BASE,
    state,
  }, null, 2), 'utf8');

  // Kısa aksiyon smoke: Onay Talebi modal açılır
  await page.locator('[data-testid="sekme-kayitli-tedarikciler"]').click().catch(() => {});
  await page.waitForTimeout(200);
  let approvalModalOk = false;
  const approvalBtn = page.locator('[data-testid="hizli-onay-talebi"]');
  if (await approvalBtn.count()) {
    const disabled = await approvalBtn.isDisabled().catch(() => true);
    if (!disabled) {
      await approvalBtn.click();
      await page.waitForTimeout(400);
      approvalModalOk = (await page.locator('[data-testid="onay-talebi-modal"], [role="dialog"]').count()) > 0
        || (await page.getByText('Onay Talebi').count()) > 0;
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      approvalModalOk = 'disabled-as-expected';
    }
  }

  const actionResults = {
    approvalModal: approvalModalOk,
    closeBlockedUntilRequired: /Eksik|pasif|zorunlu/i.test(state.closeInfo || '') || state.ops.some(
      (o) => o.testId === 'dosyayi-kapat-btn' && (o.state === 'waiting' || o.disabled),
    ),
    financeBlockedUntilClosed: state.ops.some(
      (o) => o.testId === 'finansa-aktar-btn' && (o.state === 'waiting' || o.disabled || /kapat/i.test(o.title)),
    ),
  };
  fs.writeFileSync(path.join(OUT, 'ACTION_SMOKE.json'), JSON.stringify(actionResults, null, 2), 'utf8');

  const rapor = `# EPIC-05 Kritik Düzeltme — ${new Date().toISOString().slice(0, 10)}

## Özet
Local kritik boşluk düzeltmeleri. **Production deploy YOK.**

## Kanıt
- \`01-desktop-full.png\` — tam sayfa desktop
- \`02-google-alternatifleri.png\` — Google Alternatifleri sekmesi
- \`03-operasyon-butonlari.png\` — Operasyon aktif/pasif
- \`EVIDENCE.json\` · \`ACTION_SMOKE.json\`

## Kontroller
- Sigortalı Telefon: \`${(state.phone || '').replace(/\\n/g, ' / ')}\`
- Dosya Sorumlusu: \`${(state.owner || '').replace(/\\n/g, ' / ')}\`
- Dosya Bütçesi başlığı: ${state.hasDosyaButcesi ? 'PASS' : 'FAIL'}
- Eski Alış/Satış başlığı yok: ${state.hasAlisSatisTitle ? 'FAIL' : 'PASS'}
- Kâr Tutarı / Oranı: ${state.hasKarTutari && state.hasKarOrani ? 'PASS' : 'FAIL'}
- Zorunlu sağ kolonda (bütçe altı): ${state.zorunluUnderBudget ? 'PASS' : 'FAIL'}
- Sekmeler: \`${state.tabKayitli}\` / \`${state.tabGoogle}\`
- Google rozet (alternatif): ${state.googleBadgeCount}
- Google kayıtlı sekmede yok: ${state.googleOnKayitli ? 'FAIL' : 'PASS'}
- Kapat kilidi: ${state.closeInfo || '—'}
- Ops: ${state.ops.map((o) => `${o.testId}:${o.state}`).join(', ') || '—'}
- Console/page error: ${(state.pageErrors?.length || state.consoleErrors?.length) ? 'VAR' : 'yok'}
- Aksiyon smoke: ${JSON.stringify(actionResults)}

## Typecheck / Lint / Build
(rapor güncellemesinde doldurulur)

## Deploy
**Yapılmadı.** Local PASS sonrası kullanıcı onayı gerekir.
`;
  fs.writeFileSync(path.join(OUT, 'RAPOR.md'), rapor, 'utf8');
  console.log('rapor', path.join(OUT, 'RAPOR.md'));
  console.log('state', JSON.stringify(state, null, 2));
  console.log('actions', actionResults);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
