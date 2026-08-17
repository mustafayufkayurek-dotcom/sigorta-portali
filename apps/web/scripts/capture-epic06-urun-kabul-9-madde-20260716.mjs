/**
 * EPIC-06 — Local ürün kabulü 9 madde browser doğrulama
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic06-urun-kabul-9-madde-20260716.mjs
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
    '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/epic06-urun-kabul-9-madde-20260716',
  ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';
const VENDOR_ID = process.env.VENDOR_ID || '603f75ae-c719-4ef9-9c4f-bd6f2daee00d';

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
    throw new Error(`Panel redirect failed: ${page.url()}`);
  }
}

async function apiGet(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GET ${url} failed: status=${res.status}`);
  return json?.data ?? json;
}

async function scrollToHeading(page, label) {
  return page.evaluate((text) => {
    const nodes = Array.from(document.querySelectorAll('h4, h3, h2, button, [role="tab"]'));
    const el = nodes.find((n) => (n.textContent || '').trim().includes(text));
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  }, label);
}

async function bodyHas(page, label) {
  return page.evaluate((text) => (document.body?.innerText || '').includes(text), label);
}

async function captureItem(page, fileName) {
  const filePath = path.join(OUT, fileName);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

async function main() {
  const auth = await apiLogin();
  const vendor = await apiGet(`${API}/vendors/${VENDOR_ID}`, auth.accessToken);
  const vendorUrl = `${BASE}/panel/tedarikciler/${vendor.id}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));

  await attachSession(page, auth);
  await page.goto(vendorUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText || '';
      return text.includes('Genel Bilgiler') && text.includes('Operasyon Özeti');
    },
    { timeout: 45000 },
  ).catch(() => null);
  await page.waitForTimeout(1000);

  const items = [];

  // 1 Genel Bilgiler
  {
    const found = await bodyHas(page, 'Genel Bilgiler');
    await scrollToHeading(page, 'Genel Bilgiler');
    await page.waitForTimeout(300);
    const shot = await captureItem(page, '01-genel-bilgiler.png');
    items.push({
      id: 1,
      name: 'Genel Bilgiler',
      status: found ? 'PASS' : 'FAIL',
      screenshot: shot,
      reason: found ? null : 'Sayfada "Genel Bilgiler" bölümü bulunamadı',
      fix: found ? null : 'Profil overview bileşeninde Genel Bilgiler SectionCard görünürlüğünü kontrol et',
    });
  }

  // 2 Operasyon Özeti (operasyon dili)
  {
    const found = await bodyHas(page, 'Operasyon Özeti');
    await scrollToHeading(page, 'Operasyon Özeti');
    await page.waitForTimeout(300);
    const shot = await captureItem(page, '02-operasyon-ozeti.png');
    items.push({
      id: 2,
      name: 'Operasyon Hafızası / Operasyon Özeti',
      status: found ? 'PASS' : 'FAIL',
      screenshot: shot,
      reason: found ? null : 'Sayfada "Operasyon Özeti" bölümü bulunamadı',
      fix: found ? null : 'Overview Operasyon Özeti kartını kontrol et',
    });
  }

  // 3 Maliyet Özeti
  {
    const found = await bodyHas(page, 'Maliyet Özeti');
    await scrollToHeading(page, 'Maliyet Özeti');
    await page.waitForTimeout(300);
    const shot = await captureItem(page, '03-maliyet-ozeti.png');
    items.push({
      id: 3,
      name: 'Maliyet Hafızası / Maliyet Özeti',
      status: found ? 'PASS' : 'FAIL',
      screenshot: shot,
      reason: found ? null : 'Sayfada "Maliyet Özeti" bölümü bulunamadı',
      fix: found ? null : 'Overview Maliyet Özeti kartını kontrol et',
    });
  }

  // 4 Hizmet Kalitesi
  {
    const found = await bodyHas(page, 'Hizmet Kalitesi');
    await scrollToHeading(page, 'Hizmet Kalitesi');
    await page.waitForTimeout(300);
    const shot = await captureItem(page, '04-hizmet-kalitesi.png');
    items.push({
      id: 4,
      name: 'Hizmet Kalitesi',
      status: found ? 'PASS' : 'FAIL',
      screenshot: shot,
      reason: found ? null : 'Sayfada "Hizmet Kalitesi" bölümü bulunamadı',
      fix: found ? null : 'Overview Hizmet Kalitesi kartını kontrol et',
    });
  }

  // 5 Hizmet Kapsamı
  {
    const found = await bodyHas(page, 'Hizmet Kapsamı');
    await scrollToHeading(page, 'Hizmet Kapsamı');
    await page.waitForTimeout(300);
    const shot = await captureItem(page, '05-hizmet-kapsami.png');
    items.push({
      id: 5,
      name: 'Hizmet Bölgeleri / Hizmet Kapsamı',
      status: found ? 'PASS' : 'FAIL',
      screenshot: shot,
      reason: found ? null : 'Sayfada "Hizmet Kapsamı" bölümü bulunamadı',
      fix: found ? null : 'Overview Hizmet Kapsamı kartını kontrol et',
    });
  }

  // 6 Dosya Geçmişi
  {
    const found = await bodyHas(page, 'Dosya Geçmişi');
    await scrollToHeading(page, 'Dosya Geçmişi');
    await page.waitForTimeout(300);
    const shot = await captureItem(page, '06-dosya-gecmisi.png');
    items.push({
      id: 6,
      name: 'Dosya Geçmişi',
      status: found ? 'PASS' : 'FAIL',
      screenshot: shot,
      reason: found ? null : 'Sayfada "Dosya Geçmişi" bölümü bulunamadı',
      fix: found ? null : 'Overview Dosya Geçmişi kartını kontrol et',
    });
  }

  // 7 Finans sekmesi (ilk ekranda değil)
  {
    const overviewState = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return {
        hasFinanceTab: text.includes('Finans'),
        financePanelsVisible:
          text.includes('Dosya Bazlı Ödemeler')
          || text.includes('Ödeme Ekstreleri')
          || text.includes('Toplam Ekstre'),
      };
    });

    const overviewShot = await captureItem(page, '07a-finans-sekme-ilk-ekran.png');

    let clicked = false;
    let afterClickVisible = false;
    if (overviewState.hasFinanceTab) {
      clicked = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button, [role="tab"]'));
        const tab = tabs.find((n) => (n.textContent || '').trim().includes('Finans'));
        if (!tab) return false;
        tab.click();
        return true;
      });
      await page.waitForTimeout(1200);
      afterClickVisible = await page.evaluate(() => {
        const text = document.body?.innerText || '';
        return (
          text.includes('Dosya Bazlı Ödemeler')
          || text.includes('Ödeme Ekstreleri')
          || text.includes('Banka Bilgileri')
          || text.includes('Ödemeler')
          || text.includes('Ekstre')
        );
      });
    }
    const financeShot = await captureItem(page, '07b-finans-sekme-acik.png');

    const pass =
      overviewState.hasFinanceTab
      && !overviewState.financePanelsVisible
      && clicked
      && afterClickVisible;

    let reason = null;
    let fix = null;
    if (!overviewState.hasFinanceTab) {
      reason = 'Finans sekmesi bulunamadı';
      fix = 'Vendor detail TABS listesinde Finans sekmesini kontrol et';
    } else if (overviewState.financePanelsVisible) {
      reason = 'Finans panelleri ilk ekranda (Genel Bakış) görünüyor; sekmede olmalı';
      fix = 'Finans içeriğini yalnızca odemeler sekmesine taşı';
    } else if (!clicked || !afterClickVisible) {
      reason = 'Finans sekmesine tıklanınca içerik açılmadı';
      fix = 'Finans tab click handler / odemeler içeriğini kontrol et';
    }

    items.push({
      id: 7,
      name: 'Finans Sekmesi',
      status: pass ? 'PASS' : 'FAIL',
      screenshot: financeShot,
      overviewScreenshot: overviewShot,
      checks: {
        hasFinanceTab: overviewState.hasFinanceTab,
        financePanelsOnOverview: overviewState.financePanelsVisible,
        clicked,
        afterClickVisible,
      },
      reason,
      fix,
    });

    // Genel Bakış'a dön (kalan maddeler için)
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button, [role="tab"]'));
      const tab = tabs.find((n) => (n.textContent || '').trim().includes('Genel Bakış'));
      if (tab) tab.click();
    });
    await page.waitForTimeout(1000);
    await page.waitForFunction(
      () => (document.body?.innerText || '').includes('Genel Bilgiler'),
      { timeout: 15000 },
    ).catch(() => null);
  }

  // 8 WhatsApp Geçmişi
  {
    const found = await bodyHas(page, 'WhatsApp Geçmişi');
    await scrollToHeading(page, 'WhatsApp Geçmişi');
    await page.waitForTimeout(300);
    const shot = await captureItem(page, '08-whatsapp-gecmisi.png');
    items.push({
      id: 8,
      name: 'WhatsApp Geçmişi',
      status: found ? 'PASS' : 'FAIL',
      screenshot: shot,
      reason: found ? null : 'Sayfada "WhatsApp Geçmişi" bölümü bulunamadı',
      fix: found ? null : 'Overview WhatsApp Geçmişi kartını kontrol et',
    });
  }

  // 9 Karar Özeti (teknoloji markası yok)
  {
    const state = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return {
        hasDecision: text.includes('Karar Özeti'),
        hasTechBrand:
          text.includes('Akıllı Tedarikçi Profili')
          || text.includes('Operasyon Hafızası')
          || text.includes('Maliyet Hafızası'),
      };
    });
    await scrollToHeading(page, 'Karar Özeti');
    await page.waitForTimeout(300);
    const shot = await captureItem(page, '09-karar-ozeti.png');
    const pass = state.hasDecision && !state.hasTechBrand;
    items.push({
      id: 9,
      name: 'Akıllı Tedarikçi Profili / Karar Özeti',
      status: pass ? 'PASS' : 'FAIL',
      screenshot: shot,
      checks: state,
      reason: pass
        ? null
        : (!state.hasDecision
          ? 'Sayfada "Karar Özeti" bulunamadı'
          : 'UI’da yasaklı teknoloji markası görünüyor'),
      fix: pass
        ? null
        : 'Karar Özeti kartını göster; Akıllı/Hafıza marka etiketlerini kaldır',
    });
  }

  const fullShot = path.join(OUT, '00-genel-bakis-full.png');
  await page.goto(vendorUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => (document.body?.innerText || '').includes('Genel Bilgiler'),
    { timeout: 30000 },
  ).catch(() => null);
  await page.waitForTimeout(800);
  await page.screenshot({ path: fullShot, fullPage: true });

  const passCount = items.filter((i) => i.status === 'PASS').length;
  const overall = passCount === items.length ? 'PASS' : 'FAIL';

  const evidence = {
    at: new Date().toISOString(),
    epic: 'EPIC-06-urun-kabul-9-madde',
    base: BASE,
    api: API,
    vendorId: vendor.id,
    vendorName: vendor.name,
    vendorUrl,
    overall,
    passCount: `${passCount}/${items.length}`,
    commit: false,
    push: false,
    deploy: false,
    diagnostics: { pageErrors: pageErrors.slice(0, 8) },
    items,
    fullScreenshot: fullShot,
  };

  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));

  await browser.close();
  if (overall !== 'PASS') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
