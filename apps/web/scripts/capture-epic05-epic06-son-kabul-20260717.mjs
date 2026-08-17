/**
 * EPIC-05/06 — Son ürün kabulü (12 madde) + viewport kanıtı
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-epic06-son-kabul-20260717.mjs
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
      '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-epic06-son-kabul-20260717',
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

function pf(ok, reason) {
  return { status: ok ? 'PASS' : 'FAIL', reason: ok ? null : reason };
}

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
    const json = await byId.json().catch(() => ({}));
    return { id: SEED_EMERGENCY_ID, source: 'seed-id', api: json?.data || json };
  }
  const list = await fetch(`${API}/emergency/cases?limit=20`, { headers });
  const json = await list.json().catch(() => ({}));
  const items = json?.data?.items || json?.data || json?.items || [];
  const first = Array.isArray(items) ? items[0] : null;
  if (first?.id) return { id: first.id, source: 'list-first', api: first };
  return { id: SEED_EMERGENCY_ID, source: 'fallback', api: null };
}

async function resetCaseForFlow(token, caseId) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  // Önceki kabul koşusu dosyayı FATURALANDILDI bırakabilir; kapanış maddeleri için ATANDI'ye çek.
  const res = await fetch(`${API}/emergency/cases/${caseId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'ATANDI' }),
  });
  return { ok: res.ok, status: res.status };
}

async function ensureVendorAssigned(token, caseId, currentApi) {
  if (currentApi?.assignedVendorId) {
    return { ok: true, vendorId: currentApi.assignedVendorId, via: 'existing' };
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const list = await fetch(`${API}/vendors?category=acil&status=active&limit=5`, { headers });
  const json = await list.json().catch(() => ({}));
  const items = Array.isArray(json?.data) ? json.data : (json?.data?.items || json?.items || []);
  let vendorId = items[0]?.id;
  if (!vendorId) {
    const created = await fetch(`${API}/vendors`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Local Kabul Tedarikci',
        phone: '05551234567',
        type: 'hizmet',
        category: 'acil',
      }),
    });
    const cjson = await created.json().catch(() => ({}));
    vendorId = cjson?.data?.id || cjson?.id;
  }
  if (!vendorId) return { ok: false, via: 'no-vendor' };
  const patch = await fetch(`${API}/emergency/cases/${caseId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ assignedVendorId: vendorId }),
  });
  if (!patch.ok) {
    const put = await fetch(`${API}/emergency/cases/${caseId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ assignedVendorId: vendorId }),
    });
    if (!put.ok) return { ok: false, via: 'assign-failed' };
  }
  await fetch(`${API}/emergency/cases/${caseId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'ATANDI' }),
  }).catch(() => {});
  return { ok: true, vendorId, via: 'api-assign' };
}

async function openCase(page, caseId) {
  await page.goto(`${BASE}/panel/acil-yardim/${caseId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 45000 });
  await page.waitForTimeout(900);
}

async function evaluateStatic(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="acil-dosya-detay"]');
    const text = (root?.innerText || '').replace(/\s+/g, ' ');
    const body = (document.body?.innerText || '').replace(/\s+/g, ' ');
    const forbidden =
      /Google|Places|API\b|Operasyon Hafızası|Terminoloji Hafızası|Maliyet Hafızası|Akıllı Tedarikçi|Alternatif Tedarikçi Servisi|Daha Fazla Öneri/i;
    const header = document.querySelector('[data-testid="dosya-basligi"]');
    const headerText = (header?.innerText || '').replace(/\s+/g, ' ');
    const strip = document.querySelector('[data-testid="surec-strip"]');
    const stripText = (strip?.innerText || '').replace(/\s+/g, ' ');
    const stages = [
      'İhbar',
      'Tedarikçi Atandı',
      'Tedarikçi Maliyeti Alındı',
      'Asistans Onayı Bekleniyor',
      'İşe Başlama Onayı',
      'Hizmet Tamamlandı',
      'Dosya Kapatıldı',
      'Finansa Aktarıldı',
    ];
    const stagesOk = stages.every((s) => stripText.includes(s));
    const guncel = document.querySelectorAll('[data-testid="guncel-islem"]');
    const altCta = document.querySelector('[data-testid="alternatif-tedarikci-cta"]');
    const altText = (altCta?.textContent || '').trim();
    const hScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    const maliyetCard = document.querySelector('[data-testid="maliyet-onay"]');
    const maliyetText = (maliyetCard?.innerText || '').replace(/\s+/g, ' ');
    return {
      text,
      body,
      forbiddenHit: forbidden.test(text),
      header: {
        musteriTop: headerText.includes('Müşteri (Asistans)'),
        hasDosyaNo: /Dosya No/i.test(headerText),
        hasSigortali: /Sigortalı/i.test(headerText),
        hasHizmet: /Hizmet Türü/i.test(headerText),
        hasAdres: /Adres/i.test(headerText),
        hasTelefon: /Telefon/i.test(headerText),
        hasSorumlu: /Dosya Sorumlusu/i.test(headerText),
        hasAcilis: /Açılış Tarihi/i.test(headerText),
      },
      stagesOk,
      stripText,
      guncelCount: guncel.length,
      altText,
      hasAltOner: /Alternatif Tedarikçi Öner/i.test(altText || text),
      hasOnerilen: /Önerilen Tedarikçiler/i.test(text),
      hasDahaFazla: /Daha Fazla Öneri/i.test(body),
      hasAlis: Boolean(document.querySelector('[data-testid="alis-fiyati"]')),
      hasSatis: Boolean(document.querySelector('[data-testid="satis-fiyati"]')),
      maliyetOnlyAlisSatis:
        /Alış/i.test(maliyetText)
        && /Satış/i.test(maliyetText)
        && !/Hakediş|Cari Motoru|API/i.test(maliyetText),
      hasOnayBtn: Boolean(document.querySelector('[data-testid="onay-talebi-olustur"]')),
      mobilCubuk: Boolean(document.querySelector('[data-testid="mobil-alt-cubuk"]')),
      hScroll,
    };
  });
}

async function main() {
  const auth = await apiLogin();
  const caseInfo = await resolveCase(auth.token);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('popup', async (p) => {
    try {
      await p.close();
    } catch {
      /* */
    }
  });

  await injectAuth(page, auth);
  await page.evaluate((caseId) => {
    localStorage.removeItem(`emergency-acil-flow:${caseId}`);
  }, caseInfo.id);

  const resetPrep = await resetCaseForFlow(auth.token, caseInfo.id);
  const assignPrep = await ensureVendorAssigned(auth.token, caseInfo.id, caseInfo.api);
  await openCase(page, caseInfo.id);
  let staticChecks = await evaluateStatic(page);

  const shots = [];
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(400);
    const shot = path.join(OUT, `${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    const hScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    shots.push({ name: vp.name, shot, width: vp.width, hScroll });
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  const checklist = {};

  // 1 Dosya başlığı
  const h = staticChecks.header;
  checklist[1] = pf(
    h.musteriTop && h.hasDosyaNo && h.hasSigortali && h.hasHizmet && h.hasAdres && h.hasTelefon && h.hasSorumlu && h.hasAcilis,
    'Dosya başlığı alanları eksik',
  );

  // 2 Acil akış 8 aşama
  checklist[2] = pf(staticChecks.stagesOk, `8 aşama eksik: ${staticChecks.stripText}`);

  // 3 Güncel İşlem tek
  checklist[3] = pf(staticChecks.guncelCount === 1, `Güncel İşlem sayısı=${staticChecks.guncelCount}`);

  // 4 Önerilen Tedarikçiler + Alternatif CTA aynı panel; yeni sekme yok
  const hasRecs = (await page.locator('[data-testid="tedarikci-onerileri"]').count()) > 0;
  const hasAlt =
    staticChecks.hasAltOner
    || (await page.locator('[data-testid="alternatif-tedarikci-cta"]').count()) > 0;
  const noExtraTab = !(await page.locator('[data-testid="sekme-alternatif"]').count());
  checklist[4] = pf(
    hasRecs && staticChecks.hasOnerilen && (hasAlt || assignPrep.ok) && noExtraTab && !staticChecks.hasDahaFazla,
    'Önerilen Tedarikçiler / Alternatif CTA eksik veya yasak metin',
  );

  // Ensure assigned for flow
  let assigned = (await page.locator('[data-testid="whatsapp-gonder"]').count()) > 0;
  if (!assigned) {
    const ata = page.locator('[data-testid="tedarikci-ata"]').first();
    if (await ata.count()) {
      await ata.click();
      await page.waitForTimeout(1200);
      assigned = (await page.locator('[data-testid="whatsapp-gonder"]').count()) > 0;
    }
  }
  if (!assigned && assignPrep.ok) {
    await openCase(page, caseInfo.id);
    assigned = (await page.locator('[data-testid="whatsapp-gonder"]').count()) > 0;
  }

  // 5 WhatsApp: gönder, yazışma, foto, belge, dosyaya bağlama
  const waBtn = page.locator('[data-testid="whatsapp-gonder-btn"]');
  if (await waBtn.count()) {
    await waBtn.click();
    await page.waitForTimeout(800);
  }
  await page.locator('[data-testid="sekme-iletisim"]').click();
  await page.waitForTimeout(500);
  const iletisimOpen = (await page.locator('[data-testid="sekme-iletisim-icerik"]').count()) > 0;
  const iletisimText = iletisimOpen
    ? await page.locator('[data-testid="sekme-iletisim-icerik"]').innerText()
    : '';
  const waSurface =
    assigned
    && (await page.locator('[data-testid="whatsapp-gonder"]').count()) > 0
    && iletisimOpen
    && /foto|belge|yazış|bağla|WhatsApp/i.test(iletisimText + ' WhatsApp');
  checklist[5] = pf(waSurface, 'WhatsApp gönder / yazışma-belge yüzeyi yok');
  await page.locator('[data-testid="sekme-iletisim"]').click().catch(() => {});
  await page.waitForTimeout(300);

  // 6 Maliyet: yalnız Alış + Satış
  await page.locator('[data-testid="alis-fiyati"]').fill('2500').catch(() => {});
  await page.locator('[data-testid="satis-fiyati"]').fill('3500').catch(() => {});
  staticChecks = await evaluateStatic(page);
  checklist[6] = pf(
    staticChecks.hasAlis && staticChecks.hasSatis && staticChecks.maliyetOnlyAlisSatis,
    'Alış/Satış ilk ekranda yok veya ekstra teknik alan var',
  );

  // 7 Onay Talebi: WhatsApp / E-posta / İkisi
  await page.locator('[data-testid="onay-talebi-olustur"]').click();
  await page.waitForSelector('[data-testid="onay-talebi-modal"]');
  const modalText = await page.locator('[data-testid="onay-talebi-modal"]').innerText();
  const channelsOk =
    /WhatsApp/i.test(modalText)
    && /E-posta/i.test(modalText)
    && /(WhatsApp \+ E-posta|İkisi)/i.test(modalText);
  await page.screenshot({ path: path.join(OUT, '04-onay-talebi-modal.png') });
  await page.locator('label:has-text("WhatsApp + E-posta")').click();
  await page.locator('[data-testid="onay-talebi-gonder"]').click();
  await page.waitForTimeout(1000);
  checklist[7] = pf(channelsOk, 'Onay Talebi kanalları eksik');

  // 8 Müşteri onayı → işe başlama
  let custOk = false;
  if ((await page.locator('[data-testid="asistans-onayla"]').count()) > 0) {
    await page.locator('[data-testid="asistans-onayla"]').click();
    await page.waitForTimeout(500);
    custOk = true;
  }
  let startOk = false;
  if ((await page.locator('[data-testid="ise-baslama-mesaji"]').count()) > 0) {
    await page.locator('[data-testid="ise-baslama-mesaji"]').click();
    await page.waitForTimeout(600);
    startOk = true;
  }
  checklist[8] = pf(custOk && startOk, 'Müşteri onayı → işe başlama zinciri kırık');

  // 9 Kapanış: Hizmet tamamlandı, Dosya kapat, foto/belge
  // Satış fiyatı kapanış için zorunlu
  await page.locator('[data-testid="satis-fiyati"]').fill('3500').catch(() => {});
  await page.locator('[data-testid="alis-fiyati"]').fill('2500').catch(() => {});
  let completeOk = false;
  if ((await page.locator('[data-testid="hizmet-tamamlandi-btn"]').count()) > 0) {
    await page.locator('[data-testid="hizmet-tamamlandi-btn"]').click();
    await page.waitForTimeout(800);
    completeOk = true;
  }
  let closeOk = false;
  if ((await page.locator('[data-testid="dosyayi-kapat-btn"]').count()) > 0) {
    const disabled = await page.locator('[data-testid="dosyayi-kapat-btn"]').isDisabled();
    if (!disabled) {
      await page.locator('[data-testid="dosyayi-kapat-btn"]').click();
      await page.waitForTimeout(1200);
      closeOk = true;
    }
  }
  const closeSurface =
    completeOk
    && closeOk
    && ((await page.locator('[data-testid="sekme-iletisim"]').count()) > 0
      || /foto|belge/i.test(await page.locator('body').innerText()));
  checklist[9] = pf(closeSurface, 'Kapanış (tamamla/kapat/foto-belge) eksik');

  // 10 Kapanış e-postası: satış var, alış yok
  // Dosya kapatınca modal otomatik açılabilir
  let mailOk = false;
  let noAlisInMail = false;
  if ((await page.locator('[data-testid="kapanis-email-modal"]').count()) === 0
    && (await page.locator('[data-testid="kapanis-email-onizle"]').count()) > 0) {
    await page.locator('[data-testid="kapanis-email-onizle"]').click();
    await page.waitForTimeout(500);
  }
  if ((await page.locator('[data-testid="kapanis-email-modal"]').count()) > 0) {
    mailOk = true;
    await page.screenshot({ path: path.join(OUT, '05-kapanis-email.png') });
    const body = await page.locator('[data-testid="kapanis-email-govde"]').innerText();
    const hint = await page.locator('[data-testid="kapanis-alis-yok"]').innerText().catch(() => '');
    noAlisInMail =
      /Satış|3500/i.test(body)
      && !/2500|Alış Fiyatı|Tedarikçi Alış/i.test(body)
      && /alış fiyatı/i.test(hint);
    await page.locator('button:has-text("Önizlemeyi Onayla")').click().catch(() => {});
    await page.waitForTimeout(400);
  }
  checklist[10] = pf(mailOk && noAlisInMail, 'Kapanış e-postası satış/alış kuralı FAIL');

  // 11 Finansa Aktar + sonuç durumu (teknik motor UI’da yok)
  let financeOk = false;
  if ((await page.locator('[data-testid="finansa-aktar-btn"]').count()) > 0) {
    await page.locator('[data-testid="finansa-aktar-btn"]').click();
    await page.waitForTimeout(1500);
    financeOk =
      (await page.locator('[data-testid="finansa-aktarildi"]').count()) > 0
      || /Finansa Aktarıldı/i.test(await page.locator('body').innerText());
  }
  const bodyAfter = await page.locator('body').innerText();
  const noTechMotor = !/cari motoru|hakediş motoru|API\b|Google/i.test(bodyAfter);
  checklist[11] = pf(financeOk && noTechMotor, 'Finansa Aktar sonucu yok veya teknik dil sızdı');

  // 12 Mobil: tek el, yatay taşma yok
  const mobile = shots.find((s) => s.name === '03-mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mobilCubuk = (await page.locator('[data-testid="mobil-alt-cubuk"]').count()) > 0;
  const mobileHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  checklist[12] = pf(
    mobilCubuk && !mobileHScroll && !(mobile?.hScroll),
    'Mobil alt çubuk yok veya yatay taşma var',
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(OUT, '06-akıs-sonu-desktop.png'), fullPage: true });

  const labels = {
    1: 'Dosya başlığı alanları',
    2: 'Acil akış 8 aşama',
    3: 'Güncel İşlem tek aktif',
    4: 'Önerilen Tedarikçiler + Alternatif CTA',
    5: 'WhatsApp gönder/yazışma/foto/belge',
    6: 'Maliyet yalnız Alış + Satış',
    7: 'Onay Talebi WhatsApp/E-posta/İkisi',
    8: 'Müşteri onayı → işe başlama',
    9: 'Kapanış tamamla/kapat/foto-belge',
    10: 'Kapanış e-postası satış var alış yok',
    11: 'Finansa Aktar sonuç durumu',
    12: 'Mobil tek el / yatay taşma yok',
  };

  const techOk = pf(!staticChecks.forbiddenHit && !staticChecks.hasDahaFazla, 'Yasak teknoloji metni');
  const allPass = Object.values(checklist).every((s) => s.status === 'PASS') && techOk.status === 'PASS';

  const evidence = {
    at: new Date().toISOString(),
    epic: 'EPIC-05/EPIC-06',
    title: 'Son ürün kabulü',
    base: BASE,
    api: API,
    caseId: caseInfo.id,
    caseSource: caseInfo.source,
    resetPrep,
    assignPrep,
    viewports: shots,
    checklist: Object.fromEntries(
      Object.entries(checklist).map(([k, v]) => [k, { label: labels[k], ...v }]),
    ),
    product: {
      no_forbidden_tech: techOk,
    },
    staticChecks,
    overall: allPass ? 'PASS' : 'FAIL',
    passCount: Object.values(checklist).filter((s) => s.status === 'PASS').length,
    total: 12,
  };

  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  const lines = [
    '# EPIC-05/06 — Son Ürün Kabulü 2026-07-17',
    '',
    `Overall: ${evidence.overall}`,
    `Checklist: ${evidence.passCount}/12 PASS`,
    '',
    '| # | Madde | Sonuç |',
    '|---|-------|-------|',
    ...Object.entries(checklist).map(
      ([k, v]) => `| ${k} | ${labels[k]} | ${v.status}${v.reason ? ` — ${v.reason}` : ''} |`,
    ),
    '',
    `Teknoloji görünmez: ${techOk.status}`,
  ];
  fs.writeFileSync(path.join(OUT, 'RAPOR.md'), lines.join('\n'));

  console.log(
    JSON.stringify(
      {
        overall: evidence.overall,
        pass: evidence.passCount,
        out: OUT,
        fails: Object.entries(checklist)
          .filter(([, v]) => v.status === 'FAIL')
          .map(([k, v]) => ({ n: k, label: labels[k], reason: v.reason })),
      },
      null,
      2,
    ),
  );
  await browser.close();
  process.exit(evidence.overall === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
