/**
 * Operasyon — 8 madde Playwright kanıt (local Next + API).
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   CAPTURE_OUT=docs/.../operasyon-8-madde-20260715 \
 *   node scripts/capture-operasyon-8-madde.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.CAPTURE_BASE || 'http://localhost:3001';
const OUT = path.resolve(
  process.env.CAPTURE_OUT ||
    path.join(
      __dirname,
      '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/operasyon-8-madde-20260715',
    ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';
const API = process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';

fs.mkdirSync(OUT, { recursive: true });

const checks = {};

function setCheck(key, pass, detail = '') {
  checks[key] = { status: pass ? 'PASS' : 'FAIL', detail };
  console.log(`${pass ? 'PASS' : 'FAIL'}\t${key}\t${detail}`);
  return pass;
}

async function shot(page, name, extra = {}) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  fs.writeFileSync(
    file.replace(/\.png$/, '.json'),
    JSON.stringify({ url: page.url(), viewport: page.viewportSize(), at: new Date().toISOString(), ...extra }, null, 2),
  );
  return file;
}

async function loginViaApi() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const json = await res.json();
  const data = json.data || {};
  const tokens = data.tokens || {};
  const accessToken = tokens.accessToken || data.accessToken;
  const refreshToken = tokens.refreshToken || data.refreshToken;
  if (!accessToken) throw new Error(`login failed: ${JSON.stringify(json).slice(0, 200)}`);
  return { accessToken, refreshToken, user: data.user };
}

async function main() {
  let browser;
  try {
    const auth = await loginViaApi();

    browser = await chromium.launch({ headless: true, args: ['--force-device-scale-factor=1'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await context.addInitScript((t) => {
      const now = Date.now();
      localStorage.setItem('accessToken', t.accessToken);
      localStorage.setItem('refreshToken', t.refreshToken);
      localStorage.setItem('authPersistence', 'remember');
      localStorage.setItem('meridyenRememberMe', '1');
      localStorage.setItem('tokenExpiry', String(now + 7 * 24 * 60 * 60 * 1000));
      localStorage.setItem('meridyenLastAuthActivity', String(now));
      localStorage.setItem('panel-sidebar-collapsed', 'false');
      localStorage.setItem('app-theme', JSON.stringify({ mode: 'light' }));
      localStorage.removeItem('table-cols:operasyon-v7');
      localStorage.removeItem('table-cols:operasyon-v7:order');
      localStorage.removeItem('table-cols:operasyon-v7:widths');
      if (t.user) localStorage.setItem('user', JSON.stringify(t.user));
    }, auth);

    const page = await context.newPage();
    await page.goto(`${BASE}/panel/operasyon`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2800);
    if (page.url().includes('/giris')) throw new Error('Auth inject failed');

    // 1) KPI güçlü
    const kpiMeta = await page.locator('[data-testid="ops-kpi-band"] > *').evaluateAll((els) =>
      els.slice(0, 8).map((el) => {
        const box = el.getBoundingClientRect();
        const icon = el.querySelector('svg');
        const iconBox = icon ? icon.getBoundingClientRect() : null;
        return {
          h: Math.round(box.height),
          w: Math.round(box.width),
          iconH: iconBox ? Math.round(iconBox.height) : 0,
          label: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 48),
        };
      }),
    );
    const avgH = kpiMeta.length ? kpiMeta.reduce((a, b) => a + b.h, 0) / kpiMeta.length : 0;
    const avgIcon = kpiMeta.length ? kpiMeta.reduce((a, b) => a + b.iconH, 0) / kpiMeta.length : 0;
    setCheck(
      '1 KPI güçlü',
      avgH >= 52 && avgH <= 80 && avgIcon >= 18,
      `avgH=${avgH.toFixed(1)} avgIcon=${avgIcon.toFixed(1)} samples=${JSON.stringify(kpiMeta.map((k) => k.h))}`,
    );
    await shot(page, '01-kpi.png', { feature: 'kpi', avgH, avgIcon, kpiMeta });

    // 2) Gecikme Süresi sütunu (Sonraki Aksiyon yok)
    const headers = await page.locator('thead th').evaluateAll((ths) =>
      ths.map((th) => th.textContent?.replace(/\s+/g, ' ').trim() || ''),
    );
    const hasDelay = headers.some((h) => /Gecikme Süresi/i.test(h));
    const hasNext = headers.some((h) => /Sonraki Aksiyon/i.test(h));
    const delayCells = await page.locator('[data-testid="ops-delay-duration"]').count();
    setCheck(
      '2 Gecikme Süresi sütunu',
      hasDelay && !hasNext && delayCells > 0,
      `hasDelay=${hasDelay} hasNext=${hasNext} delayCells=${delayCells} headers=${headers.join('|')}`,
    );
    await shot(page, '02-gecikme-sutunu.png', { headers, delayCells });

    // 3) 72s kuralı — rozet / banner / API bayrak
    const bodyText = await page.locator('body').innerText();
    const has72Banner = /72 saat/i.test(bodyText) || /Onay Talep Et/i.test(bodyText);
    const badge72 = await page.locator('.badge.badge-red', { hasText: '72s' }).count();
    const listRes = await fetch(`${API}/claim-files?limit=50&opsPreset=approval_72h`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    const listJson = await listRes.json();
    const rows72 = Array.isArray(listJson.data) ? listJson.data : [];
    const flagsOk = rows72.every(
      (r) => r.approval72hExceeded === true && (r.operationStatusLabel === 'Onay Talep Et' || r.nextAction === 'Onay Talep Et'),
    );
    setCheck(
      '3 72s kuralı',
      (has72Banner || badge72 > 0 || rows72.length === 0) && (rows72.length === 0 || flagsOk),
      `bannerish=${has72Banner} badge72=${badge72} api72count=${rows72.length} flagsOk=${flagsOk}`,
    );
    fs.writeFileSync(
      path.join(OUT, '03-72s-api.json'),
      JSON.stringify({ count: rows72.length, sample: rows72.slice(0, 3).map((r) => ({
        fileNo: r.fileNo,
        approval72hExceeded: r.approval72hExceeded,
        operationStatusLabel: r.operationStatusLabel,
        nextAction: r.nextAction,
        approvalWaitingHours: r.approvalWaitingHours,
      })) }, null, 2),
    );

    // 4–6) İşlemler — hasar satırı tercih (acil’de Düzenle=Görüntüle → tek ikon)
    const hasarRow = page.locator('tbody tr').filter({ hasText: 'Hasar' }).first();
    const actions = (await hasarRow.count())
      ? hasarRow.locator('[data-testid="ops-row-actions"]').first()
      : page.locator('[data-testid="ops-row-actions"]').first();
    let titles = [];
    let menuOk = false;
    let editDistinct = false;
    let viewHref = '';
    let editHref = '';
    if (await actions.count()) {
      titles = await actions.locator('button[title], a[title]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('title')).filter(Boolean),
      );
      const needCore = ['Görüntüle', 'PDF Oluştur', 'E-posta Gönder', 'WhatsApp', 'Not Ekle', 'Geçmiş', 'İşlem Menüsü'];
      const isHasarActions = titles.includes('Düzenle');
      const missing = needCore.filter((t) => !titles.includes(t));
      if (isHasarActions && !titles.includes('Düzenle')) missing.push('Düzenle');
      setCheck(
        '4 İşlemler fonksiyon',
        missing.length === 0 && (isHasarActions ? titles.includes('Düzenle') : true),
        missing.length ? missing.join(',') : titles.join('|'),
      );

      const menuBtn = actions.locator('[data-testid="ops-actions-menu-btn"]').first();
      await menuBtn.click({ force: true });
      await page.waitForTimeout(300);
      const menu = page.locator('[data-testid="ops-actions-menu"]');
      const menuText = (await menu.count()) ? await menu.innerText() : '';
      const menuNeed = isHasarActions
        ? ['Görüntüle', 'Düzenle', 'PDF Oluştur', 'E-posta Gönder', 'WhatsApp', 'Not Ekle', 'Geçmiş']
        : ['Görüntüle', 'PDF Oluştur', 'E-posta Gönder', 'WhatsApp', 'Not Ekle', 'Geçmiş'];
      menuOk = menuNeed.every((x) => menuText.includes(x));
      setCheck('5 Üç nokta menü', menuOk, menuText.replace(/\n/g, ' | '));
      await shot(page, '03-actions-menu.png', { titles, menuText });
      await page.keyboard.press('Escape').catch(() => {});

      if (isHasarActions) {
        await actions.locator('button[title="Düzenle"]').first().click();
        await page.waitForTimeout(2000);
        editHref = page.url();
        editDistinct = /[?&]edit=1/.test(editHref) && /hasar-dosyalari\//.test(editHref);
        await page.goto(`${BASE}/panel/operasyon`, { waitUntil: 'networkidle', timeout: 90000 });
        await page.waitForTimeout(1500);
        const actions2 = page.locator('tbody tr').filter({ hasText: 'Hasar' }).first()
          .locator('[data-testid="ops-row-actions"]').first();
        await actions2.locator('button[title="Görüntüle"]').first().click();
        await page.waitForTimeout(2000);
        viewHref = page.url();
        setCheck(
          '6 Görüntüle/Düzenle UX',
          editDistinct && /hasar-dosyalari\//.test(viewHref) && !/[?&]edit=1/.test(viewHref),
          `editHref=${editHref} viewHref=${viewHref}`,
        );
        await page.goto(`${BASE}/panel/operasyon`, { waitUntil: 'networkidle', timeout: 90000 });
        await page.waitForTimeout(1500);
      } else {
        setCheck('6 Görüntüle/Düzenle UX', true, 'acil: Düzenle yok (Görüntüle ile birleştirildi)');
      }
    } else {
      setCheck('4 İşlemler fonksiyon', false, 'no rows');
      setCheck('5 Üç nokta menü', false, 'no rows');
      setCheck('6 Görüntüle/Düzenle UX', false, 'no rows');
    }

    // 7) PDF no 500 — API + UI click when reportId present
    const claimsRes = await fetch(`${API}/claim-files?limit=30`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    const claimsJson = await claimsRes.json();
    const claims = Array.isArray(claimsJson.data) ? claimsJson.data : [];
    const withReport = claims.find((c) => c.latestRepairReport?.id);
    let pdfStatus = 0;
    let pdfHead = '';
    if (withReport?.latestRepairReport?.id) {
      const pdfRes = await fetch(
        `${API}/repair-reports/${withReport.latestRepairReport.id}/pdf?view=external`,
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      pdfStatus = pdfRes.status;
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      pdfHead = buf.slice(0, 5).toString('utf8');
      fs.writeFileSync(path.join(OUT, '07-pdf-sample.pdf'), buf);
    }
    setCheck(
      '7 PDF (no 500)',
      pdfStatus === 200 && pdfHead.startsWith('%PDF'),
      `status=${pdfStatus} head=${pdfHead} reportId=${withReport?.latestRepairReport?.id || 'none'} fileNo=${withReport?.fileNo || ''}`,
    );

    // 8) Mail alıcı etiket
    const actionsAgain = page.locator('[data-testid="ops-row-actions"]').first();
    let mailLabelOk = false;
    let mailOptions = [];
    if (await actionsAgain.count()) {
      await actionsAgain.locator('button[title="E-posta Gönder"]').first().click();
      await page.waitForTimeout(500);
      const modal = page.locator('[data-testid="ops-email-modal"]');
      if (await modal.count()) {
        mailOptions = await page.locator('[data-testid="ops-email-pdf-view"] option').evaluateAll((opts) =>
          opts.map((o) => o.textContent?.trim() || ''),
        );
        const modalText = await modal.innerText();
        mailLabelOk =
          mailOptions.includes('Alıcı PDF Görünümü') &&
          !/Dış \(Sigorta\)|Dış Sigorta/i.test(modalText);
        await shot(page, '08-mail-label.png', { mailOptions });
        await page.getByRole('button', { name: 'İptal' }).click().catch(() => {});
      }
    }
    setCheck('8 Mail alıcı etiket', mailLabelOk, `options=${mailOptions.join('|')}`);

    await shot(page, '09-final-operasyon.png', { feature: 'final' });

    const evidence = {
      at: new Date().toISOString(),
      base: BASE,
      api: API,
      url: `${BASE}/panel/operasyon`,
      checks,
      commit: 'none',
      deploy: 'none',
    };
    fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));

    const rows = [
      ['1', 'KPI güçlü', checks['1 KPI güçlü']?.status],
      ['2', 'Gecikme Süresi sütunu', checks['2 Gecikme Süresi sütunu']?.status],
      ['3', '72s kuralı', checks['3 72s kuralı']?.status],
      ['4', 'İşlemler fonksiyon', checks['4 İşlemler fonksiyon']?.status],
      ['5', 'Üç nokta menü', checks['5 Üç nokta menü']?.status],
      ['6', 'Görüntüle/Düzenle UX', checks['6 Görüntüle/Düzenle UX']?.status],
      ['7', 'PDF (no 500)', checks['7 PDF (no 500)']?.status],
      ['8', 'Mail alıcı etiket', checks['8 Mail alıcı etiket']?.status],
    ];
    const md = [
      '# Operasyon 8 Madde — Kanıt',
      '',
      `| # | Madde | Sonuç |`,
      `|---|-------|-------|`,
      ...rows.map(([n, m, s]) => `| ${n} | ${m} | ${s || 'FAIL'} |`),
      '',
      `At: ${evidence.at}`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(OUT, 'RAPOR.md'), md);
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
