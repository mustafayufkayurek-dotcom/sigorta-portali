/**
 * EPIC-03 Operasyon FINAL — Playwright kanıt (local Next).
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   CAPTURE_OUT=.../epic-03-operasyon-final-20260715 \
 *   node scripts/capture-epic03-operasyon-final.mjs
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
      '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-final-20260715',
    ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';
const API = process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';

fs.mkdirSync(OUT, { recursive: true });

const checks = {};

function setCheck(key, pass, detail = '') {
  checks[key] = { status: pass ? 'PASS' : 'FAIL', detail };
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
      // Fresh view prefs for FINAL (v6)
      localStorage.removeItem('table-cols:operasyon-v6');
      localStorage.removeItem('table-cols:operasyon-v6:order');
      localStorage.removeItem('table-cols:operasyon-v6:widths');
      if (t.user) localStorage.setItem('user', JSON.stringify(t.user));
    }, auth);

    const page = await context.newPage();
    await page.goto(`${BASE}/panel/operasyon`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2800);
    if (page.url().includes('/giris')) throw new Error('Auth inject failed');

    const bodyText = await page.locator('body').innerText();

    // KPI height + focus
    const kpiMeta = await page.locator('[data-testid="ops-kpi-band"] > *').evaluateAll((els) =>
      els.slice(0, 8).map((el) => {
        const box = el.getBoundingClientRect();
        return { h: Math.round(box.height), label: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 40) };
      }),
    );
    const kpiHeights = kpiMeta.map((k) => k.h);
    const avgH = kpiHeights.length ? kpiHeights.reduce((a, b) => a + b, 0) / kpiHeights.length : 0;
    setCheck('KPI yükseklik +%15 dengeli', avgH >= 44 && avgH <= 64, `avgH=${avgH.toFixed(1)} samples=${JSON.stringify(kpiHeights)}`);
    fs.writeFileSync(path.join(OUT, '01-kpi-height.json'), JSON.stringify({ avgH, kpiMeta }, null, 2));

    const kpiLabels = [
      'Açık Dosya', 'Onay Bekleyen', 'Rapor Yazılıyor', 'Rapor Onayı',
      'Finansa Aktarılacak', '72 Saat + Risk', 'Bugün Açılan', 'Acil Dosya',
    ];
    const kpiBandText = (await page.locator('[data-testid="ops-kpi-band"]').count())
      ? await page.locator('[data-testid="ops-kpi-band"]').innerText()
      : '';
    const kpiHits = kpiLabels.filter((l) => kpiBandText.includes(l));
    setCheck(
      'KPI operasyon odağı',
      kpiHits.length === 8 && !kpiBandText.includes('Gelen Kutu') && !kpiBandText.includes('E-posta'),
      `hits=${kpiHits.length}`,
    );
    await shot(page, '01-operasyon-kpi.png', { feature: 'kpi', avgH });

    // Column lines — inset after: pseudo (border-r unreliable under table layout)
    const lineSample = await page.locator('thead th').evaluateAll((ths) =>
      ths.slice(0, 6).map((th) => {
        const s = getComputedStyle(th);
        const after = getComputedStyle(th, '::after');
        const afterW = parseFloat(after.width || '0');
        const afterBg = after.backgroundColor || '';
        const hasAfterLine =
          afterW >= 1 &&
          afterBg &&
          afterBg !== 'rgba(0, 0, 0, 0)' &&
          afterBg !== 'transparent';
        const hasBorder = parseFloat(s.borderRightWidth || '0') >= 1;
        return {
          text: th.textContent?.trim().slice(0, 24),
          hasAfterLine,
          afterW,
          afterBg,
          borderRight: s.borderRightWidth,
          hasBorder,
          className: th.className,
        };
      }),
    );
    const hasLines = lineSample.filter((x) => x.hasAfterLine || x.hasBorder).length >= 2;
    setCheck('Kolon çizgileri', hasLines, JSON.stringify(lineSample));

    // Sort icons
    const sortMarks = await page.locator('thead th').evaluateAll((ths) =>
      ths.map((th) => ({
        text: th.textContent?.replace(/\s+/g, ' ').trim().slice(0, 48),
        hasArrow: /[↑↓]/.test(th.textContent || ''),
      })).filter((h) => h.text),
    );
    const dataHeaders = sortMarks.filter((h) => h.text && !/^İşlemler/.test(h.text));
    setCheck(
      'Sort ikonları tüm kolonlar',
      dataHeaders.length > 0 && dataHeaders.every((h) => h.hasArrow),
      JSON.stringify(dataHeaders),
    );
    fs.writeFileSync(path.join(OUT, '02-sort-headers.json'), JSON.stringify(sortMarks, null, 2));

    // Column picker: hide/show + save + reorder buttons exist
    const colsBtn = page.getByRole('button', { name: /Sütunlar/i }).first();
    setCheck('Kolon gizle/göster', await colsBtn.count() > 0, 'Sütunlar button');
    if (await colsBtn.count()) {
      await colsBtn.click();
      await page.waitForTimeout(300);
      const saveBtn = page.locator('[data-testid="table-view-save"]');
      setCheck('Görünüm kaydet', await saveBtn.count() > 0, 'Görünümü Kaydet button');
      const moveBtns = page.locator('button[title="Sola taşı"], button[title="Sağa taşı"]');
      setCheck('Kolon sıralama (reorder)', (await moveBtns.count()) >= 2, `moveBtns=${await moveBtns.count()}`);
      // Toggle date column if present
      const dateLabel = page.locator('label').filter({ hasText: 'Tarih' }).first();
      if (await dateLabel.count()) {
        await dateLabel.click();
        await page.waitForTimeout(200);
      }
      if (await saveBtn.count()) {
        await saveBtn.click();
        await page.waitForTimeout(200);
      }
      // Resize: check separator exists
      const seps = page.locator('thead [role="separator"]');
      setCheck('Kolon genişlik', (await seps.count()) >= 3, `separators=${await seps.count()}`);
      await shot(page, '02-column-picker.png', { feature: 'columns' });
      // Close picker via its backdrop (fixed inset-0 z-20)
      const backdrop = page.locator('div.fixed.inset-0.z-20').first();
      if (await backdrop.count()) {
        await backdrop.click({ force: true }).catch(() => {});
      } else {
        await colsBtn.click().catch(() => {});
      }
      await page.waitForTimeout(250);
      // Ensure backdrop gone
      if (await page.locator('div.fixed.inset-0.z-20').count()) {
        await page.locator('div.fixed.inset-0.z-20').first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
      }
    } else {
      setCheck('Görünüm kaydet', false, 'no picker');
      setCheck('Kolon sıralama (reorder)', false, 'no picker');
      setCheck('Kolon genişlik', false, 'no picker');
    }

    // Icon tooltips + menu
    const actions = page.locator('[data-testid="ops-row-actions"]').first();
    if (await actions.count()) {
      const titles = await actions.locator('button[title], a[title]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('title')).filter(Boolean),
      );
      const needTitles = [
        'Görüntüle', 'Düzenle', 'PDF Oluştur', 'E-posta Gönder', 'WhatsApp',
        'Not Ekle', 'Geçmiş', 'Arşive Taşı', 'İşlem Menüsü',
      ];
      const missingTitles = needTitles.filter((t) => !titles.includes(t));
      setCheck('Tooltip her ikon', missingTitles.length === 0, missingTitles.length ? missingTitles.join(',') : titles.join('|'));

      // Wire checks via title buttons present (clickable)
      setCheck('Görüntüle', titles.includes('Görüntüle'));
      setCheck('Düzenle', titles.includes('Düzenle'));
      setCheck('PDF Oluştur', titles.includes('PDF Oluştur'));
      setCheck('WhatsApp', titles.includes('WhatsApp'));
      setCheck('Not Ekle', titles.includes('Not Ekle'));
      setCheck('Geçmiş', titles.includes('Geçmiş'));
      setCheck('Arşive Taşı', titles.includes('Arşive Taşı'));

      const menuBtn = page.locator('[data-testid="ops-actions-menu-btn"]').first();
      await menuBtn.scrollIntoViewIfNeeded().catch(() => {});
      await menuBtn.click({ force: true });
      await page.waitForTimeout(350);
      const menu = page.locator('[data-testid="ops-actions-menu"]');
      const menuText = (await menu.count()) ? await menu.innerText() : '';
      const menuNeed = [
        'Görüntüle', 'Düzenle', 'PDF Oluştur', 'E-posta Gönder', 'WhatsApp',
        'Not Ekle', 'Geçmiş', 'Arşive Taşı',
      ];
      const menuMissing = menuNeed.filter((x) => !menuText.includes(x));
      setCheck('Üç nokta menü', menuMissing.length === 0, menuMissing.length ? menuMissing.join(',') : menuText.replace(/\n/g, ' | '));
      await shot(page, '03-actions-menu.png', { feature: 'actions', menuText, titles });

      // Email UI
      await menu.getByText('E-posta Gönder', { exact: true }).click();
      await page.waitForTimeout(500);
      const modal = page.locator('[data-testid="ops-email-modal"]');
      const modalOpen = (await modal.count()) > 0;
      const hasTo = modalOpen && (await page.locator('[data-testid="ops-email-to"]').count()) > 0;
      const hasPdf = modalOpen && (await page.locator('[data-testid="ops-email-pdf-attach"]').count()) > 0;
      const hasTpl = modalOpen && (await page.locator('[data-testid="ops-email-template"]').count()) > 0;
      const hasNote = modalOpen && (await page.locator('[data-testid="ops-email-note-link"]').count()) > 0;
      setCheck(
        'E-posta Gönder (UI+PDF bağ)',
        modalOpen && hasTo && hasPdf && hasTpl && hasNote,
        `modal=${modalOpen} to=${hasTo} pdf=${hasPdf} tpl=${hasTpl} note=${hasNote}`,
      );
      await shot(page, '04-email-modal.png', { feature: 'email' });
      if (modalOpen) {
        await page.getByRole('button', { name: 'İptal' }).click().catch(() => {});
      }
    } else {
      for (const k of [
        'Tooltip her ikon', 'Görüntüle', 'Düzenle', 'PDF Oluştur', 'WhatsApp',
        'Not Ekle', 'Geçmiş', 'Arşive Taşı', 'Üç nokta menü', 'E-posta Gönder (UI+PDF bağ)',
      ]) {
        setCheck(k, false, 'no rows');
      }
    }

    await shot(page, '06-final-operasyon-1440.png', { feature: 'final' });

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
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
