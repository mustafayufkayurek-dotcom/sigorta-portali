/**
 * EPIC-05 FINAL — Acil Yardım Dosya Detay local ürün kabulü
 * Inject/mock YASAK — gerçek login + gerçek dosya. page.tsx'e dokunulmaz.
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-acil-dosya-detay-final-kabul-20260716.mjs
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
      '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-acil-dosya-detay-final-kabul-20260716',
    ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';
const SEED_EMERGENCY_ID = process.env.EMERGENCY_CASE_ID || 'f4624c59-30e9-4380-8ac9-abb2f0c36757';
const HISTORICAL_CUTOFF = new Date('2026-07-01T00:00:00+03:00');

fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: '01-desktop', width: 1440, height: 900 },
  { name: '02-tablet', width: 768, height: 1024 },
  { name: '03-mobile', width: 390, height: 844 },
];

function passFail(ok, reason) {
  return { status: ok ? 'PASS' : 'FAIL', reason: ok ? null : reason };
}

async function login(page) {
  await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/panel/, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function resolveCase(page) {
  const token = await page.evaluate(() => {
    try {
      return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    } catch {
      return '';
    }
  });
  if (!token) return { id: SEED_EMERGENCY_ID, source: 'seed-fallback-no-token', api: null };

  const headers = { Authorization: `Bearer ${token}` };
  let apiCase = null;
  const byId = await fetch(`${API}/emergency/cases/${SEED_EMERGENCY_ID}`, { headers });
  if (byId.ok) {
    const json = await byId.json().catch(() => ({}));
    apiCase = json?.data || json;
    return { id: SEED_EMERGENCY_ID, source: 'seed-id', api: apiCase, token };
  }

  const list = await fetch(`${API}/emergency/cases?limit=20`, { headers });
  const json = await list.json().catch(() => ({}));
  const items = json?.data?.items || json?.data || json?.items || [];
  const first = Array.isArray(items) ? items[0] : null;
  if (first?.id) {
    const detail = await fetch(`${API}/emergency/cases/${first.id}`, { headers });
    const djson = detail.ok ? await detail.json().catch(() => ({})) : {};
    apiCase = djson?.data || djson || first;
    return {
      id: first.id,
      source: 'list-first',
      caseNo: first.caseNo || first.fileNo,
      api: apiCase,
      token,
    };
  }
  return { id: SEED_EMERGENCY_ID, source: 'seed-fallback', api: null, token };
}

async function findHistoricalCase(token) {
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };
  const list = await fetch(`${API}/emergency/cases?limit=50`, { headers });
  if (!list.ok) return null;
  const json = await list.json().catch(() => ({}));
  const items = json?.data?.items || json?.data || json?.items || [];
  if (!Array.isArray(items)) return null;

  for (const item of items) {
    const dateRaw = item.fileDate || item.createdAt;
    if (!dateRaw) continue;
    const d = new Date(dateRaw);
    if (Number.isNaN(d.getTime())) continue;
    if (d < HISTORICAL_CUTOFF) {
      return {
        id: item.id,
        caseNo: item.caseNo || item.fileNo,
        fileDate: dateRaw,
      };
    }
  }
  return null;
}

async function evaluatePageChecks(page, { historicalMode = false } = {}) {
  return page.evaluate(({ historicalMode: hist }) => {
    const root = document.querySelector('[data-testid="acil-dosya-detay"]');
    const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ');
    const header = root?.querySelector('h1')?.closest('.bg-white') || root?.children?.[0];
    const headerText = (header?.innerText || '').replace(/\s+/g, ' ');

    const hasMusteri = /Müşteri/.test(headerText);
    const hasSigortali = /Sigortalı/.test(headerText);
    const hasHizmet = /Hizmet Türü/.test(headerText);
    const hasAdres = /Adres/.test(headerText);
    const hasSorumlu = /Dosya Sorumlusu/.test(headerText);
    const logoInHeader = !!(
      header?.querySelector('img') ||
      header?.querySelector('[class*="logo" i]') ||
      header?.querySelector('svg[aria-label*="logo" i]')
    );

    const guncel = document.querySelector('[data-testid="guncel-islem"]');
    const guncelCards = guncel
      ? 1
      : document.querySelectorAll('[data-testid="guncel-islem"]').length;
    const guncelCount = document.querySelectorAll('[data-testid="guncel-islem"]').length;
    const guncelTitleCount = [...document.querySelectorAll('p,h2')].filter(
      (el) => (el.textContent || '').trim() === 'Güncel İşlem',
    ).length;

    const tedarik = document.querySelector('[data-testid="tedarikci-onerileri"]');
    const tedarikText = (tedarik?.innerText || '').replace(/\s+/g, ' ');
    const recItems = tedarik ? tedarik.querySelectorAll('ul li').length : 0;
    const hasGoogle = /Google/.test(tedarikText);
    const googleOnlyWhenEmpty = recItems === 0 ? hasGoogle || /önerisi yok/i.test(tedarikText) : !hasGoogle;

    const maliyet = document.querySelector('[data-testid="maliyet-onay"]');
    const maliyetText = (maliyet?.innerText || '').replace(/\s+/g, ' ');
    const hasAlis = /Alış/.test(maliyetText);
    const hasSatis = /Satış/.test(maliyetText);
    // Maliyet kartında ve kapalı Finans sekmesinde Hakediş/Cari/KDV/Kâr olmamalı
    const maliyetForbidden = /Hakediş|Cari|KDV|Kâr Oranı|Net Kâr/.test(maliyetText);
    const alt = document.querySelector('[data-testid="alt-sekmeler"]');
    const altText = (alt?.innerText || '').replace(/\s+/g, ' ');
    // Kapalı sekme yalnızca "Dosya Geçmişi / Finans" başlıklarını gösterir
    const finansPanelOpen = /Net Kâr|Hakediş:|Kâr Oranı|KDV özeti/.test(altText);
    const firstScreenHasForbidden = maliyetForbidden || finansPanelOpen;

    const whatsapp = document.querySelector('[data-testid="whatsapp-iletisim"]');
    const waText = (whatsapp?.innerText || '').replace(/\s+/g, ' ');
    const waBound = /yazışma|foto|belge|Belge|Evrak|iletişim/i.test(waText);
    const waNoAutoStage = /otomatik algı|sonraki sürüm|aşama|otomatik/i.test(waText) || /Otomatik algı metni sonraki sürümde/.test(waText);

    const historicalBlockers = /eksik finans|finans uyarısı|zorunlu yeni süreç|tarihsel dosya bloker|01\.07\.2026 öncesi.*zorunlu|sahte bloker/i.test(bodyText);

    // Horizontal overflow
    const docEl = document.documentElement;
    const hasHScroll = Math.ceil(docEl.scrollWidth) > Math.ceil(window.innerWidth) + 2;

    // Touch targets: primary CTAs near top (Onay Talebi, Ata)
    const onayBtn = [...document.querySelectorAll('button')].find((b) =>
      /Onay Talebi Oluştur/.test(b.textContent || ''),
    );

    return {
      hist,
      header: {
        hasMusteri,
        hasSigortali,
        hasHizmet,
        hasAdres,
        hasSorumlu,
        logoInHeader,
        headerText: headerText.slice(0, 400),
      },
      guncel: {
        count: guncelCount,
        titleCount: guncelTitleCount,
        present: !!guncel,
        cards: guncelCards,
      },
      tedarik: {
        recItems,
        hasGoogle,
        googleOnlyWhenEmpty,
        text: tedarikText.slice(0, 300),
      },
      maliyet: {
        hasAlis,
        hasSatis,
        firstScreenHasForbidden,
        maliyetText: maliyetText.slice(0, 300),
      },
      whatsapp: {
        present: !!whatsapp,
        waBound,
        waNoAutoStage,
        text: waText.slice(0, 400),
      },
      historicalBlockers,
      bodySnippet: bodyText.slice(0, 800),
      hasHScroll,
      scrollWidth: docEl.scrollWidth,
      innerWidth: window.innerWidth,
      onayBtnPresent: !!onayBtn,
      url: location.href,
      hasRoot: !!root,
    };
  }, { historicalMode });
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
    caseNo: null,
    fileDate: null,
    historicalCase: null,
    viewports: [],
    maddeler: {},
    overall: 'FAIL',
  };

  try {
    await login(page);
    if (!/\/panel/.test(page.url())) {
      evidence.loginError = `Login failed, url=${page.url()}`;
      fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
      console.error('LOGIN FAIL', page.url());
      await browser.close();
      process.exit(1);
    }

    const resolved = await resolveCase(page);
    evidence.caseId = resolved.id;
    evidence.caseSource = resolved.source;
    evidence.caseNo = resolved.caseNo || resolved.api?.caseNo || resolved.api?.fileNo || null;
    evidence.fileDate = resolved.api?.fileDate || resolved.api?.createdAt || null;

    const historical = await findHistoricalCase(resolved.token);
    evidence.historicalCase = historical;

    const detailUrl = `${BASE}/panel/acil-yardim/${resolved.id}`;
    const checks = {};

    // Desktop first — full madde evaluation
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const desktopShot = path.join(OUT, '01-desktop.png');
    await page.screenshot({ path: desktopShot, fullPage: true });

    let ui = await evaluatePageChecks(page);

    // Madde 1
    checks['1_dosya_basligi'] = passFail(
      ui.hasRoot &&
        ui.header.hasMusteri &&
        ui.header.hasSigortali &&
        ui.header.hasHizmet &&
        ui.header.hasAdres &&
        ui.header.hasSorumlu &&
        !ui.header.logoInHeader,
      !ui.hasRoot
        ? 'Dosya detay root bulunamadı'
        : `Eksik alan veya logo var: musteri=${ui.header.hasMusteri} sigortali=${ui.header.hasSigortali} hizmet=${ui.header.hasHizmet} adres=${ui.header.hasAdres} sorumlu=${ui.header.hasSorumlu} logo=${ui.header.logoInHeader}`,
    );

    // Madde 2
    checks['2_guncel_islem'] = passFail(
      ui.guncel.present && ui.guncel.count === 1 && ui.guncel.titleCount === 1,
      `Aktif işlem kartı sayısı beklenen 1 değil: count=${ui.guncel.count} titleCount=${ui.guncel.titleCount}`,
    );

    // Madde 3
    checks['3_tedarikci_onerileri'] = passFail(
      ui.tedarik.recItems <= 3 && ui.tedarik.googleOnlyWhenEmpty,
      `Öneri=${ui.tedarik.recItems} google=${ui.tedarik.hasGoogle} googleOnlyWhenEmpty=${ui.tedarik.googleOnlyWhenEmpty}`,
    );

    // Madde 4
    checks['4_maliyet_onay'] = passFail(
      ui.maliyet.hasAlis && ui.maliyet.hasSatis && !ui.maliyet.firstScreenHasForbidden,
      `Alış=${ui.maliyet.hasAlis} Satış=${ui.maliyet.hasSatis} forbidden=${ui.maliyet.firstScreenHasForbidden}`,
    );

    // Madde 5 — open approval modal
    const onayBtn = page.locator('button', { hasText: 'Onay Talebi Oluştur' }).first();
    await onayBtn.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    const modalText = await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' '));
    const hasWa = modalText.includes('WhatsApp') && /E-posta/.test(modalText);
    const hasBoth = /WhatsApp \+ E-posta/.test(modalText);
    const radioCount = await page.locator('input[name="approvalChannel"]').count();
    checks['5_onay_talebi'] = passFail(
      hasWa && hasBoth && radioCount >= 3,
      `Modal kanalları eksik: hasWa=${hasWa} hasBoth=${hasBoth} radios=${radioCount}`,
    );
    const modalShot = path.join(OUT, '04-onay-talebi-modal.png');
    await page.screenshot({ path: modalShot, fullPage: false });
    await page.locator('button', { hasText: 'İptal' }).first().click().catch(() => {});
    await page.waitForTimeout(400);

    // Madde 6
    checks['6_whatsapp'] = passFail(
      ui.whatsapp.present && ui.whatsapp.waBound && ui.whatsapp.waNoAutoStage,
      `WA present=${ui.whatsapp.present} bound=${ui.whatsapp.waBound} noAutoStage=${ui.whatsapp.waNoAutoStage}`,
    );

    // Madde 7 — historical rule
    // Requirement: pre-01.07.2026 files must NOT show fake blocker / missing finance warning / forced new process.
    // If no historical case OR no explicit product rule → FAIL per kabul criteria.
    let madde7 = null;
    if (!historical) {
      madde7 = passFail(
        false,
        '01.07.2026 öncesi tarihsel dosya local ortamda bulunamadı; tarihsel kural doğrulanamadı (kural yok/kanıt yok → FAIL)',
      );
    } else {
      await page.goto(`${BASE}/panel/acil-yardim/${historical.id}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1800);
      const histUi = await evaluatePageChecks(page, { historicalMode: true });
      const histShot = path.join(OUT, '05-tarihsel-dosya.png');
      await page.screenshot({ path: histShot, fullPage: true });
      // Explicit rule presence: page must NOT invent blockers; also we require evidence of intentional historical handling.
      // Product criterion: absence of fake blockers on historical file. Code has no dedicated historical branch → still PASS visually if no blockers shown.
      // User instruction: "Yoksa veya kural yoksa FAIL" — no code rule for historical → FAIL.
      madde7 = passFail(
        false,
        `Tarihsel dosya bulundu (${historical.caseNo || historical.id}, ${historical.fileDate}) ancak kodda 01.07.2026 cutoff / tarihsel muafiyet kuralı yok; kabul kriteri 'kural yoksa FAIL'. UI bloker metni: ${histUi.historicalBlockers}`,
      );
      evidence.historicalUi = {
        blockers: histUi.historicalBlockers,
        shot: histShot,
        url: page.url(),
      };
      // Return to main case for remaining shots
      await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
    checks['7_tarihsel_dosya'] = madde7;

    // Madde 8 — mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const mobileShot = path.join(OUT, '03-mobile.png');
    await page.screenshot({ path: mobileShot, fullPage: true });
    const mobileUi = await evaluatePageChecks(page);

    // Max 2 touch: back + primary action OR single primary CTA reachable without horizontal scroll
    const touchOk = !mobileUi.hasHScroll && mobileUi.onayBtnPresent && mobileUi.hasRoot;
    checks['8_mobil'] = passFail(
      touchOk,
      `hScroll=${mobileUi.hasHScroll} (${mobileUi.scrollWidth}>${mobileUi.innerWidth}) onayBtn=${mobileUi.onayBtnPresent}`,
    );

    // Tablet shot
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const tabletShot = path.join(OUT, '02-tablet.png');
    await page.screenshot({ path: tabletShot, fullPage: true });

    evidence.viewports = [
      { name: '01-desktop', shot: desktopShot, width: 1440 },
      { name: '02-tablet', shot: tabletShot, width: 768 },
      { name: '03-mobile', shot: mobileShot, width: 390, hScroll: mobileUi.hasHScroll },
      { name: '04-onay-talebi-modal', shot: modalShot },
    ];
    evidence.maddeler = checks;
    evidence.uiSample = {
      header: ui.header,
      guncel: ui.guncel,
      tedarik: ui.tedarik,
      maliyet: ui.maliyet,
      whatsapp: ui.whatsapp,
    };

    const allPass = Object.values(checks).every((c) => c.status === 'PASS');
    evidence.overall = allPass ? 'PASS' : 'FAIL';

    // Human report
    const order = [
      ['1_dosya_basligi', '1. Dosya Başlığı'],
      ['2_guncel_islem', '2. Güncel İşlem'],
      ['3_tedarikci_onerileri', '3. Tedarikçi Önerileri'],
      ['4_maliyet_onay', '4. Maliyet ve Onay'],
      ['5_onay_talebi', '5. Onay Talebi'],
      ['6_whatsapp', '6. WhatsApp'],
      ['7_tarihsel_dosya', '7. Tarihsel Dosya'],
      ['8_mobil', '8. Mobil'],
    ];
    const lines = [];
    for (const [key, label] of order) {
      const c = checks[key];
      lines.push(label);
      lines.push(c.status);
      if (c.reason) lines.push(`Neden: ${c.reason}`);
      lines.push('');
    }
    if (allPass) {
      lines.push('EPIC-05 Local Ürün Kabulü Tamamlandı');
    }
    const report = lines.join('\n');
    fs.writeFileSync(path.join(OUT, 'RAPOR.txt'), report);
    fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
    console.log(report);
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
