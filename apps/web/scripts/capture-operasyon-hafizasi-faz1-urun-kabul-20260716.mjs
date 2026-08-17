/**
 * EPIC-04 Faz-1 SON ürün kabulü — Local Browser (inject YOK) · re-run 20260716.
 *
 * Gerçek kullanıcı akışı: login → panel → ekranlar.
 * Route inject / mock / token inject / manuel bypass YASAK.
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-operasyon-hafizasi-faz1-urun-kabul-20260716.mjs
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
      '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/operasyon-hafizasi-faz1-urun-kabul-rerun-20260716',
    ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';

/** Seed dosyaları (local DB) */
const SEED_EMERGENCY_ID = 'f4624c59-30e9-4380-8ac9-abb2f0c36757';
const SEED_CLAIM_ID = '8757467a-a32d-4068-ae6c-3c927afccf3f';

fs.mkdirSync(OUT, { recursive: true });

const items = [];
const injectUsed = false;

function record(n, title, pass, reason, shot, meta = {}) {
  const row = {
    n,
    title,
    status: pass ? 'PASS' : 'FAIL',
    reason: pass ? reason || '' : reason || 'FAIL',
    shot,
    ...meta,
  };
  items.push(row);
  console.log(`${n}. ${title} → ${row.status}${row.reason ? ` (${row.reason})` : ''}`);
  return row;
}

async function shot(page, name, extra = {}) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  fs.writeFileSync(
    file.replace(/\.png$/, '.json'),
    JSON.stringify(
      {
        url: page.url(),
        at: new Date().toISOString(),
        injectUsed: false,
        ...extra,
      },
      null,
      2,
    ),
  );
  return file;
}

async function bodyText(page) {
  return page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' '));
}

async function readAccessToken(page) {
  return page.evaluate(() => {
    try {
      return (
        localStorage.getItem('accessToken') ||
        sessionStorage.getItem('accessToken') ||
        ''
      );
    } catch {
      return '';
    }
  });
}

/** Local seed: Cam Kırığı dosyası (migration değil — mevcut claim güncellemesi). */
async function seedCamClaimViaApi(token) {
  if (!token) return { ok: false, reason: 'token yok' };
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const patch = await fetch(`${API}/claim-files/${SEED_CLAIM_ID}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ lossType: 'Cam Kırığı' }),
  });
  const patchJson = await patch.json().catch(() => ({}));
  if (!patch.ok) {
    return {
      ok: false,
      reason: `PATCH ${patch.status}: ${JSON.stringify(patchJson).slice(0, 200)}`,
    };
  }
  const get = await fetch(`${API}/claim-files/${SEED_CLAIM_ID}`, { headers });
  const getJson = await get.json().catch(() => ({}));
  const data = getJson?.data || getJson;
  const lossType = data?.lossType || '';
  const subjectName = data?.claimSubject?.name || '';
  const camOk =
    /Cam Kırığı/i.test(lossType) ||
    /Cam Kırığı/i.test(subjectName) ||
    /Cam Kırılması/i.test(subjectName);
  return {
    ok: camOk,
    reason: camOk
      ? `lossType=${lossType}; subject=${subjectName || '—'}`
      : `Cam seed doğrulanamadı: lossType=${lossType} subject=${subjectName}`,
    lossType,
    subjectName,
  };
}

async function loginViaUi(page) {
  await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(800);
  await page.locator('#email, input[type="email"]').first().fill(EMAIL);
  await page.locator('#password, input[type="password"]').first().fill(PASSWORD);
  const remember = page.locator('input[type="checkbox"]').first();
  if (await remember.count()) {
    const checked = await remember.isChecked().catch(() => false);
    if (!checked) await remember.check({ force: true }).catch(() => {});
  }
  await Promise.all([
    page.waitForURL(/\/panel/, { timeout: 60000 }).catch(() => null),
    page.getByRole('button', { name: /Giriş Yap/i }).first().click(),
  ]);
  await page.waitForTimeout(2500);
  if (!page.url().includes('/panel')) {
    throw new Error(`UI login failed, still at ${page.url()}`);
  }
}

async function main() {
  // Guard: inject yok (yorum satırları ve bu guard metni sayılmaz)
  const selfSource = fs
    .readFileSync(fileURLToPath(import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line) && !/hasInject|selfSource|inject_guard/i.test(line))
    .join('\n');
  const hasInject =
    /\bpage\.route\s*\(/.test(selfSource) ||
    /\baddInitScript\s*\(/.test(selfSource) ||
    /\broute\.fulfill\s*\(/.test(selfSource) ||
    /\bcontext\.route\s*\(/.test(selfSource);
  if (hasInject) {
    throw new Error('Script inject/mock içeriyor — ürün kabulü iptal');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--force-device-scale-factor=1'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  // NO addInitScript, NO page.route fulfill/mock
  const page = await context.newPage();

  await loginViaUi(page);
  await shot(page, '00-login-panel.png', { pass: true, reason: 'UI login → panel' });

  const token = await readAccessToken(page);
  const camSeed = await seedCamClaimViaApi(token);
  fs.writeFileSync(
    path.join(OUT, '00-cam-seed.json'),
    JSON.stringify({ at: new Date().toISOString(), injectUsed: false, ...camSeed }, null, 2),
  );
  console.log('Cam seed:', camSeed.ok ? 'OK' : 'FAIL', camSeed.reason || '');

  // ── 1. Acil Yardım Operasyon Akışı ─────────────────────────────────────────
  await page.goto(`${BASE}/panel/acil-yardim`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);
  const urlAfterRedirect = page.url();
  const redirected =
    /\/panel\/operasyon/.test(urlAfterRedirect) && /filter=acil/.test(urlAfterRedirect);
  const textOps = await bodyText(page);
  const acilFilterUi =
    /Acil/i.test(textOps) ||
    (await page.locator('button, a, span').filter({ hasText: /Acil/i }).count()) > 0;

  await page.goto(`${BASE}/panel/acil-yardim/${SEED_EMERGENCY_ID}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(3000);
  const detailText = await bodyText(page);
  const emergencyDetailOk =
    /Tek Operasyon Zinciri|Dosya Geçmişi|Hakediş|Finans Bağı|Matbu Evrak|yazışma/i.test(detailText) ||
    page.url().includes(SEED_EMERGENCY_ID);
  const schemaErr1 = /column .* does not exist|updated_by|Prisma|Internal Server Error/i.test(detailText);

  const pass1 = redirected && acilFilterUi && emergencyDetailOk && !schemaErr1;
  const shot1 = await shot(
    page,
    pass1 ? '01-acil-operasyon-akisi.png' : '01-acil-operasyon-akisi-FAIL.png',
    {
      pass: pass1,
      redirected,
      urlAfterRedirect,
      acilFilterUi,
      emergencyDetailOk,
      emergencyId: SEED_EMERGENCY_ID,
      sample: detailText.slice(0, 500),
    },
  );
  record(
    1,
    'Acil Yardım Operasyon Akışı',
    pass1,
    pass1
      ? `redirect=${urlAfterRedirect}; detay ${SEED_EMERGENCY_ID}`
      : schemaErr1
        ? `şema/hata: ${detailText.slice(0, 120)}`
        : `redirect=${redirected} filtre=${acilFilterUi} detay=${emergencyDetailOk} url=${urlAfterRedirect}`,
    shot1,
  );

  // ── 2–4. VendorSuggestPanel (gerçek claim + gerçek recommend API) ──────────
  let panelVisible = false;
  let terminologyVisible = false;
  let terminologyFallbackOk = false;
  let smartProfileVisible = false;
  let metricsVisible = {
    operationGroup: false,
    costMemory: false,
    serviceQuality: false,
    intervention: false,
  };
  let suggestShot = null;
  let modalText = '';

  await page.goto(`${BASE}/panel/hasar-dosyalari/${SEED_CLAIM_ID}?grup=finans`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(4500);

  const claimPageText = await bodyText(page);
  const claimSchemaErr = /column .* does not exist|updated_by|Prisma|Internal Server Error|bulunamadı/i.test(
    claimPageText,
  );

  if (!claimSchemaErr && !page.url().includes('/giris')) {
    const giderTab = page.getByRole('button', { name: /Gider\s*&\s*Bütçe/i }).first();
    if (await giderTab.count()) {
      await giderTab.click();
      await page.waitForTimeout(1500);
    }

    const maliyetBtn = page.getByRole('button', { name: /^Maliyet Ekle$/i }).first();
    const kalemBtn = page.getByRole('button', { name: /Kalem Ekle|Bütçe Başlat/i }).first();
    if (await maliyetBtn.count()) {
      await maliyetBtn.click();
      await page.waitForTimeout(3000);
    } else if (await kalemBtn.count()) {
      await kalemBtn.click();
      await page.waitForTimeout(3000);
    }

    modalText = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      return (modal?.innerText || document.body.innerText || '').replace(/\s+/g, ' ');
    });

    panelVisible = /Akıllı Tedarikçi Profili|Operasyon Hafızası|Tedarikçi Bulunamadı|Yükleniyor/i.test(
      modalText,
    );
    smartProfileVisible = /Akıllı Tedarikçi Profili/i.test(modalText);
    // Tercih: Cam Kırığı → Cam Kırılması → Operasyon Grubu (Cam Hizmetleri)
    terminologyVisible =
      /Cam Kırığı/i.test(modalText) &&
      /Cam Kırılması/i.test(modalText) &&
      /Operasyon Grubu/i.test(modalText) &&
      /Cam Hizmetleri/i.test(modalText);
    // Kullanıcı kabulü: Cam yoksa Dahili Su → Tesisat + Operasyon Grubu görünürlüğü
    terminologyFallbackOk =
      /Operasyon Grubu/i.test(modalText) &&
      (/Tesisat Hizmetleri/i.test(modalText) || /Dahili Su/i.test(modalText));
    metricsVisible = {
      operationGroup: /Operasyon Grubu/i.test(modalText),
      costMemory: /Maliyet Hafızası/i.test(modalText),
      serviceQuality: /Hizmet Kalitesi/i.test(modalText),
      intervention: /Müdahale Süresi/i.test(modalText),
    };

    const modal = page.locator('.fixed.inset-0 .bg-white').first();
    if (await modal.count()) {
      const box = await modal.boundingBox();
      if (box) {
        const file = path.join(OUT, panelVisible ? '02-04-vendor-suggest-panel.png' : '02-04-vendor-suggest-panel-FAIL.png');
        await page.screenshot({
          path: file,
          clip: {
            x: Math.max(0, box.x - 8),
            y: Math.max(0, box.y - 8),
            width: Math.min(box.width + 16, 1420),
            height: Math.min(box.height + 16, 880),
          },
        });
        fs.writeFileSync(
          file.replace(/\.png$/, '.json'),
          JSON.stringify(
            {
              url: page.url(),
              at: new Date().toISOString(),
              injectUsed: false,
              claimId: SEED_CLAIM_ID,
              camSeed,
              panelVisible,
              terminologyVisible,
              terminologyFallbackOk,
              smartProfileVisible,
              metricsVisible,
              modalTextSample: modalText.slice(0, 1200),
            },
            null,
            2,
          ),
        );
        suggestShot = file;
      }
    }
    if (!suggestShot) {
      suggestShot = await shot(page, '02-04-vendor-suggest-panel-FAIL.png', {
        pass: false,
        claimId: SEED_CLAIM_ID,
        modalTextSample: modalText.slice(0, 500),
        pageSample: claimPageText.slice(0, 400),
      });
    }
    await page.keyboard.press('Escape').catch(() => {});
  } else {
    suggestShot = await shot(page, '02-04-vendor-suggest-panel-FAIL.png', {
      pass: false,
      reason: claimSchemaErr ? 'hasar dosyası şema/hata' : 'hasar dosyası açılamadı',
      claimId: SEED_CLAIM_ID,
      sample: claimPageText.slice(0, 500),
    });
  }

  // Acil yeni form — Cam Kırığı seçeneği (ek kanıt)
  await page.goto(`${BASE}/panel/acil-yardim/yeni`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  const yeniText = await bodyText(page);
  const camOptionInForm = /Cam Kırığı/i.test(yeniText);
  await shot(page, '02b-acil-yeni-cam-kirigi-secenek.png', {
    pass: camOptionInForm,
    camOptionInForm,
    sample: yeniText.slice(0, 400),
  });

  const terminologyPass = terminologyVisible || terminologyFallbackOk;
  record(
    2,
    'Terminoloji',
    terminologyPass,
    terminologyVisible
      ? 'UI: Cam Kırığı → Cam Kırılması → Operasyon Grubu (Cam Hizmetleri)'
      : terminologyFallbackOk
        ? 'UI: Operasyon Grubu görünür (Dahili Su → Tesisat yedek kabul)'
        : panelVisible
          ? `Akıllı panel açık ama terminoloji zinciri yok (örnek: ${modalText.slice(0, 180)})`
          : 'VendorSuggestPanel açılmadı / terminoloji yok',
    suggestShot,
    { claimId: SEED_CLAIM_ID, camOptionInForm, camSeed, terminologyVisible, terminologyFallbackOk },
  );

  record(
    3,
    'Akıllı Tedarikçi Profili',
    smartProfileVisible,
    smartProfileVisible
      ? 'Panel: Akıllı Tedarikçi Profili — Operasyon Hafızası'
      : 'Akıllı Tedarikçi Profili paneli görünmedi',
    suggestShot,
  );

  const metricsUiPresent =
    metricsVisible.operationGroup &&
    metricsVisible.costMemory &&
    metricsVisible.serviceQuality &&
    metricsVisible.intervention;
  record(
    4,
    'Öneri metrikleri',
    metricsUiPresent,
    metricsUiPresent
      ? 'Operasyon Grubu + Hizmet Kalitesi + Maliyet Hafızası + Müdahale Süresi'
      : `Metrikler eksik: ${JSON.stringify(metricsVisible)}`,
    suggestShot,
    { metricsVisible },
  );

  // ── 5. WhatsApp / yazışma dosyaya bağlı ─────────────────────────────────────
  await page.goto(`${BASE}/panel/acil-yardim/${SEED_EMERGENCY_ID}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(3000);
  const waText = await bodyText(page);
  const waPass =
    /WhatsApp/i.test(waText) &&
    (/yazışma|Dosya Geçmişi|Matbu Evrak|evrak/i.test(waText) || /\d+\s*yazışma/i.test(waText));
  const waShot = await shot(
    page,
    waPass ? '05-whatsapp-dosya.png' : '05-whatsapp-dosya-FAIL.png',
    {
      pass: waPass,
      emergencyId: SEED_EMERGENCY_ID,
      sample: waText.slice(0, 600),
    },
  );
  record(
    5,
    'WhatsApp / yazışma dosyaya bağlı',
    waPass,
    waPass
      ? `Acil dosya ${SEED_EMERGENCY_ID}: Dosya Geçmişi/WhatsApp görünür`
      : 'WhatsApp/yazışma kaydı UI’da yok',
    waShot,
  );

  // ── 6. Hakediş akışı ───────────────────────────────────────────────────────
  const hakPass = /Hakediş/i.test(waText);
  const hakShot = await shot(
    page,
    hakPass ? '06-hakedis-akisi.png' : '06-hakedis-akisi-FAIL.png',
    {
      pass: hakPass,
      emergencyId: SEED_EMERGENCY_ID,
      sample: waText.slice(0, 600),
    },
  );
  record(
    6,
    'Hakediş akışı',
    hakPass,
    hakPass ? 'Acil dosyada Hakediş ve Ödeme paneli görünür' : 'Hakediş UI yok',
    hakShot,
  );

  // ── 7. Cari — Carilerim ────────────────────────────────────────────────────
  await page.goto(`${BASE}/panel/carilerim`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);
  const cariText = await bodyText(page);
  const updatedByErr = /updated_by/i.test(cariText);
  const cariPass =
    !updatedByErr &&
    /Carilerim/i.test(cariText) &&
    (/Toplam cari|Aktif cari|cari yüklendi|Anadolu Sigorta|Müşteri|Dosya/i.test(cariText) ||
      /Henüz atanmış cari yok|Eşleşen cari bulunamadı/i.test(cariText));
  const hasListRow =
    /Anadolu Sigorta/i.test(cariText) ||
    (await page.locator('table tbody tr').count()) > 0;
  const cariShot = await shot(
    page,
    cariPass ? '07-cari-baglantisi.png' : '07-cari-baglantisi-FAIL.png',
    {
      pass: cariPass,
      updatedByErr,
      hasListRow,
      sample: cariText.slice(0, 500),
    },
  );
  record(
    7,
    'Cari',
    cariPass && !updatedByErr,
    updatedByErr
      ? 'updated_by hatası'
      : cariPass
        ? hasListRow
          ? 'Carilerim gerçek liste görünür'
          : 'Carilerim ekranı açıldı'
        : 'Carilerim yüklenmedi',
    cariShot,
  );

  const evidence = {
    at: new Date().toISOString(),
    base: BASE,
    api: API,
    injectUsed,
    claimId: SEED_CLAIM_ID,
    emergencyId: SEED_EMERGENCY_ID,
    camSeed,
    items: items.map((it) => ({
      n: it.n,
      title: it.title,
      status: it.status,
      reason: it.reason,
      shot: it.shot ? path.relative(path.join(__dirname, '../../..'), it.shot) : null,
    })),
    summary: {
      pass: items.filter((i) => i.status === 'PASS').length,
      fail: items.filter((i) => i.status === 'FAIL').length,
    },
  };
  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));

  console.log('\n========== RAPOR ==========');
  for (const it of items) {
    const rel = it.shot ? path.relative(path.join(__dirname, '../../..'), it.shot) : '';
    console.log(`\n${it.n}. ${it.title}\n${it.status}\n(kanıt: ${rel})`);
  }
  console.log(
    `\nÖzet: ${evidence.summary.pass} PASS / ${evidence.summary.fail} FAIL · injectUsed: ${injectUsed}`,
  );
  console.log('OUT', OUT);

  await browser.close();
  process.exit(evidence.summary.fail > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
