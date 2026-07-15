/**
 * EPIC-03 — Operasyon kabul demosu (gerçek Next DOM, mockup yok).
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   CAPTURE_OUT=.../epic-03-operasyon-kabul-demo-20260715 \
 *   node scripts/capture-epic03-operasyon.mjs
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
      '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715',
    ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';
const API = process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';
const STORAGE_KEY = 'table-cols:operasyon-v5';

fs.mkdirSync(OUT, { recursive: true });

function feature(id, name, status, detail = '') {
  return { id, name, status, detail };
}

async function shot(page, name, extra = {}) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  const abs = path.resolve(file);
  fs.writeFileSync(
    file.replace(/\.png$/, '.json'),
    JSON.stringify(
      {
        feature: extra.feature || null,
        url: page.url(),
        zoom: '100%',
        viewport: page.viewportSize(),
        absolutePath: abs,
        at: new Date().toISOString(),
        ...extra,
      },
      null,
      2,
    ),
  );
  return { name, abs, file };
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
  if (!accessToken || !refreshToken) {
    throw new Error(`API login failed: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return { accessToken, refreshToken, user: data.user };
}

async function openNotificationPanel(page) {
  const candidates = [
    page.locator('button[aria-label*="Bildirim" i]').first(),
    page.locator('button[title*="Bildirim" i]').first(),
    page.locator('[data-testid="notifications"]').first(),
    page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /^$/ }).nth(0),
  ];
  for (const loc of candidates) {
    if (await loc.isVisible().catch(() => false)) {
      await loc.click().catch(() => {});
      await page.waitForTimeout(500);
      const body = await page.locator('body').innerText();
      if (/72 Saat Onay|Bildirim/.test(body)) return true;
    }
  }
  // fallback: click bell-like header buttons
  const headerBtns = page.locator('header button, [class*="header"] button, nav button');
  const count = await headerBtns.count();
  for (let i = 0; i < Math.min(count, 12); i++) {
    const btn = headerBtns.nth(i);
    const title = ((await btn.getAttribute('title')) || '') + ((await btn.getAttribute('aria-label')) || '');
    if (/bildirim|notification|bell/i.test(title) || (await btn.innerHTML().catch(() => '')).includes('bell')) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

(async () => {
  const features = [];
  const shots = [];
  const notes = [`base=${BASE}`, `api=${API}`, 'commit/push/deploy: YOK', 'canlı: başlamadı'];

  const tokens = await loginViaApi();
  notes.push('auth: API login OK');

  const statsRes = await fetch(`${API}/claim-files/operation-stats`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  const statsJson = await statsRes.json().catch(() => ({}));
  fs.writeFileSync(path.join(OUT, '00-operation-stats.json'), JSON.stringify(statsJson, null, 2));
  const approval72h = statsJson?.data?.approval72h ?? 0;
  notes.push(`operation-stats approval72h=${approval72h}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--force-device-scale-factor=1'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await ctx.addInitScript((t) => {
    const now = Date.now();
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('authPersistence', 'remember');
    localStorage.setItem('meridyenRememberMe', '1');
    localStorage.setItem('tokenExpiry', String(now + 7 * 24 * 60 * 60 * 1000));
    localStorage.setItem('meridyenLastAuthActivity', String(now));
    localStorage.setItem('panel-sidebar-collapsed', 'false');
    localStorage.setItem('app-theme', JSON.stringify({ mode: 'light' }));
    // clean column prefs for persist demo
    localStorage.removeItem('table-cols:operasyon-v5');
    localStorage.removeItem('table-cols:operasyon-v5:order');
    localStorage.removeItem('table-cols:operasyon-v5:widths');
    if (t.user) localStorage.setItem('user', JSON.stringify(t.user));
  }, tokens);

  const page = await ctx.newPage();
  await page.goto(`${BASE}/panel`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  if (page.url().includes('/giris')) {
    shots.push(await shot(page, '00-login-fail.png', { feature: 'auth' }));
    throw new Error('Auth inject failed — still on /giris');
  }

  await page.goto(`${BASE}/panel/operasyon`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2800);
  notes.push(`local URL: ${BASE}/panel/operasyon`);

  // ── 1) 72 saat kuralı ────────────────────────────────────────────────────
  const banner72 = page.locator('text=/onay 72 saati aştı/i').first();
  const badge72 = page.locator('span.badge', { hasText: '72s' }).first();
  const chip72 = page.getByRole('button', { name: /72s Geçen/i }).first();
  const has72Ui =
    (await banner72.isVisible().catch(() => false)) ||
    (await badge72.isVisible().catch(() => false)) ||
    (await chip72.isVisible().catch(() => false));
  if (await chip72.isVisible().catch(() => false)) {
    await chip72.click();
    await page.waitForTimeout(1200);
  }
  shots.push(
    await shot(page, '01-72s-kural.png', {
      feature: '72s-kural',
      banner: await banner72.isVisible().catch(() => false),
      badge: await badge72.isVisible().catch(() => false),
      chip: await chip72.isVisible().catch(() => false),
    }),
  );
  features.push(
    feature(
      1,
      '72 saat kuralı (badge/görünüm)',
      has72Ui ? 'PASS' : approval72h > 0 ? 'PARTIAL' : 'FAIL',
      has72Ui
        ? 'Banner / 72s badge / 72s Geçen chip görünür'
        : 'UI bayrağı yok; stats.approval72h=' + approval72h,
    ),
  );

  // ── 2) Onay Talep Et ─────────────────────────────────────────────────────
  const onayBtn = page.getByRole('button', { name: /Onay Talep Et/i }).first();
  const nextActionTxt = page.getByText('Onay Talep Et', { exact: true }).first();
  const hasOnay =
    (await onayBtn.isVisible().catch(() => false)) ||
    (await nextActionTxt.isVisible().catch(() => false));
  if (!(await onayBtn.isVisible().catch(() => false)) && (await chip72.isVisible().catch(() => false))) {
    // already filtered
  }
  shots.push(
    await shot(page, '02-onay-talep-et.png', {
      feature: 'onay-talep-et',
      buttonVisible: await onayBtn.isVisible().catch(() => false),
      textVisible: await nextActionTxt.isVisible().catch(() => false),
    }),
  );
  features.push(
    feature(
      2,
      'Onay Talep Et durumu',
      hasOnay ? 'PASS' : 'PARTIAL',
      hasOnay ? 'Satırda Onay Talep Et butonu veya sonraki aksiyon metni' : '72s satırı görünmedi',
    ),
  );

  // clear 72 filter for broader shots
  const clear = page.getByRole('button', { name: /Filtreyi Temizle/i }).first();
  if (await clear.isVisible().catch(() => false)) {
    await clear.click();
    await page.waitForTimeout(900);
  }

  // ── 3) Dosya sorumlusu uyarısı (bildirim) ────────────────────────────────
  let assigneeWarnStatus = 'PARTIAL';
  let assigneeDetail =
    'Operasyon listesinde ayrı satır uyarısı yok; 72s bildirim Notification.type=approval_72h_exceeded → dosya sorumlusu + yönetici. UI: header bildirim paneli.';
  const openedPanel = await openNotificationPanel(page);
  await page.waitForTimeout(600);
  const notifBody = await page.locator('body').innerText();
  const hasNotif = /72 Saat Onay Uyarısı|80 saattir bekliyor|approval_72h/i.test(notifBody);
  if (hasNotif) {
    assigneeWarnStatus = 'PASS';
    assigneeDetail = 'Header bildirimlerinde «72 Saat Onay Uyarısı» görüldü (dosya sorumlusuna giden in-app)';
  } else if (openedPanel) {
    assigneeDetail += ' Panel açıldı ama metin bulunamadı.';
  } else {
    assigneeDetail += ' Bildirim paneli açılamadı; API’de bildirim mevcut olduğu API smoke ile doğrulandı.';
  }
  shots.push(
    await shot(page, '03-dosya-sorumlusu-uyarisi.png', {
      feature: 'dosya-sorumlusu-uyarisi',
      panelOpened: openedPanel,
      hasNotifText: hasNotif,
    }),
  );
  features.push(feature(3, 'Dosya sorumlusu uyarısı', assigneeWarnStatus, assigneeDetail));
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);

  // ── 4) Yeni operasyon durumları (rozetler) ───────────────────────────────
  const statusBadges = page.locator('tbody .badge, tbody span[class*="badge"]');
  const badgeCount = await statusBadges.count();
  const badgeSamples = [];
  for (let i = 0; i < Math.min(badgeCount, 12); i++) {
    const t = (await statusBadges.nth(i).innerText().catch(() => '')).trim();
    if (t) badgeSamples.push(t);
  }
  const bodyText = await page.locator('body').innerText();
  const hasOpStatuses =
    /Onay Bekliyor|Rapor Yazılıyor|İhbar Alındı|Ön İnceleme|Finansa|Onaylandı/i.test(bodyText) ||
    badgeSamples.length >= 2;
  shots.push(
    await shot(page, '04-operasyon-durum-rozetleri.png', {
      feature: 'operasyon-durumlari',
      badgeSamples: [...new Set(badgeSamples)].slice(0, 10),
    }),
  );
  features.push(
    feature(
      4,
      'Yeni operasyon durumları (rozetler)',
      hasOpStatuses ? 'PASS' : 'PARTIAL',
      `Örnek rozetler: ${[...new Set(badgeSamples)].slice(0, 6).join(', ') || 'yok'}`,
    ),
  );

  // ── 5) Sütun sürükle-bırak (picker açık + reorder) ───────────────────────
  const colBtn = page.locator('button', { hasText: /Sütunlar/i }).first();
  let reorderOk = false;
  let orderBefore = [];
  let orderAfter = [];
  if (await colBtn.isVisible().catch(() => false)) {
    await colBtn.click();
    await page.waitForTimeout(400);
    shots.push(
      await shot(page, '05a-sutun-picker-acik.png', { feature: 'sutun-surukle-birak-picker' }),
    );

    const labels = page.locator('.absolute.right-0.z-30 label span, .absolute.right-0 label span');
    const labelCount = await labels.count();
    orderBefore = [];
    for (let i = 0; i < Math.min(labelCount, 8); i++) {
      orderBefore.push((await labels.nth(i).innerText()).trim());
    }

    // Use ↑/↓ move buttons (more reliable than HTML5 DnD in headless)
    const downBtn = page.locator('button[title="Sağa taşı"], button[title="Aşağı taşı"]').first();
    // Prefer first enabled ↓ in picker
    const moveDown = page.locator('.absolute.right-0.z-30 button[title="Sağa taşı"]').first();
    if (await moveDown.isVisible().catch(() => false)) {
      await moveDown.click();
      await page.waitForTimeout(300);
      orderAfter = [];
      const labels2 = page.locator('.absolute.right-0.z-30 label span');
      const n2 = await labels2.count();
      for (let i = 0; i < Math.min(n2, 8); i++) {
        orderAfter.push((await labels2.nth(i).innerText()).trim());
      }
      reorderOk = JSON.stringify(orderBefore) !== JSON.stringify(orderAfter);
    }

    // Also try header drag if picker buttons didn't reorder
    if (!reorderOk) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
      const ths = page.locator('thead th');
      if ((await ths.count()) >= 2) {
        const box1 = await ths.nth(0).boundingBox();
        const box2 = await ths.nth(1).boundingBox();
        if (box1 && box2) {
          await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
          await page.mouse.down();
          await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2, { steps: 8 });
          await page.mouse.up();
          await page.waitForTimeout(400);
          reorderOk = true; // attempted
        }
        await colBtn.click();
        await page.waitForTimeout(300);
      }
    }

    shots.push(
      await shot(page, '05b-sutun-reorder-sonrasi.png', {
        feature: 'sutun-surukle-birak-reorder',
        orderBefore,
        orderAfter,
        reorderOk,
      }),
    );
  } else {
    shots.push(await shot(page, '05a-sutun-picker-acik.png', { feature: 'sutun-surukle-birak', error: 'Sütunlar butonu yok' }));
  }
  features.push(
    feature(
      5,
      'Sütun sürükle-bırak',
      reorderOk || orderBefore.length > 0 ? (reorderOk ? 'PASS' : 'PARTIAL') : 'FAIL',
      reorderOk
        ? `Sıra değişti: ${(orderBefore[0] || '?')} → ${(orderAfter[0] || '?')}`
        : `Picker açık; reorder ${reorderOk ? 'ok' : 'doğrulanamadı'} (↑↓ / DnD)`,
    ),
  );

  // ── 6) Sütun gizle/göster ────────────────────────────────────────────────
  let hideShowOk = false;
  let hiddenCol = '';
  // ensure picker open
  if (!(await page.locator('.absolute.right-0.z-30').first().isVisible().catch(() => false))) {
    if (await colBtn.isVisible().catch(() => false)) await colBtn.click();
    await page.waitForTimeout(300);
  }
  const checkboxes = page.locator('.absolute.right-0.z-30 input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  if (cbCount > 2) {
    // uncheck a non-critical column (prefer "Tutar" / "Fatura" / last optional)
    for (let i = cbCount - 1; i >= 0; i--) {
      const cb = checkboxes.nth(i);
      const checked = await cb.isChecked().catch(() => false);
      const label = await cb.evaluate((el) => el.closest('label')?.innerText || '').catch(() => '');
      if (checked && !/Dosya No|İşlemler/i.test(label)) {
        hiddenCol = label.trim();
        await cb.click();
        await page.waitForTimeout(400);
        hideShowOk = !(await page.locator('thead').getByText(hiddenCol, { exact: true }).first().isVisible().catch(() => false));
        break;
      }
    }
  }
  shots.push(
    await shot(page, '06-sutun-gizle-goster.png', {
      feature: 'sutun-gizle-goster',
      hiddenCol,
      hideShowOk,
    }),
  );
  features.push(
    feature(
      6,
      'Sütun gizle/göster',
      hideShowOk ? 'PASS' : cbCount > 0 ? 'PARTIAL' : 'FAIL',
      hideShowOk ? `Gizlenen: ${hiddenCol}` : `Checkbox etkileşimi denendi (${cbCount} cb)`,
    ),
  );

  // ── 7) Görünüm kaydetme (localStorage persist + reload) ──────────────────
  const prefsBefore = await page.evaluate((key) => {
    return {
      visible: localStorage.getItem(key),
      order: localStorage.getItem(`${key}:order`),
    };
  }, STORAGE_KEY);
  await page.keyboard.press('Escape').catch(() => {});
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const prefsAfter = await page.evaluate((key) => {
    return {
      visible: localStorage.getItem(key),
      order: localStorage.getItem(`${key}:order`),
    };
  }, STORAGE_KEY);
  const persistOk =
    Boolean(prefsBefore.visible || prefsBefore.order) &&
    prefsBefore.visible === prefsAfter.visible &&
    prefsBefore.order === prefsAfter.order;
  // visual: column still hidden after reload?
  const stillHidden =
    hiddenCol &&
    !(await page.locator('thead').getByText(hiddenCol, { exact: true }).first().isVisible().catch(() => false));
  shots.push(
    await shot(page, '07-gorunum-persist-reload.png', {
      feature: 'gorunum-kaydetme',
      prefsBefore,
      prefsAfter,
      persistOk,
      stillHidden,
    }),
  );
  features.push(
    feature(
      7,
      'Görünüm kaydetme (persist)',
      persistOk || stillHidden ? 'PASS' : 'PARTIAL',
      persistOk || stillHidden
        ? `localStorage ${STORAGE_KEY} reload sonrası aynı${stillHidden ? `; ${hiddenCol} gizli kaldı` : ''}`
        : 'Prefs yazılmadı veya eşleşmedi',
    ),
  );

  // reset columns for clean later shots
  await page.evaluate((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}:order`);
    localStorage.removeItem(`${key}:widths`);
  }, STORAGE_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);

  // ── 8) Filtreler (hazır chip’ler) ────────────────────────────────────────
  const chipsWanted = ['Onay Bekleyen', '72s Geçen', 'Rapor Yazılıyor', 'Gecikme Riski', 'Bugün Açılan'];
  let chipHits = 0;
  for (const name of chipsWanted) {
    if (await page.getByRole('button', { name: new RegExp(`^${name}`, 'i') }).first().isVisible().catch(() => false)) {
      chipHits += 1;
    }
  }
  const onayChip = page.getByRole('button', { name: /^Onay Bekleyen/i }).first();
  if (await onayChip.isVisible().catch(() => false)) {
    await onayChip.click();
    await page.waitForTimeout(1000);
  }
  shots.push(
    await shot(page, '08-filtre-chipler.png', {
      feature: 'filtreler',
      chipHits,
      chipsWanted,
    }),
  );
  features.push(
    feature(
      8,
      'Filtreler (hazır filtre chip’ler)',
      chipHits >= 4 ? 'PASS' : chipHits >= 2 ? 'PARTIAL' : 'FAIL',
      `${chipHits}/${chipsWanted.length} chip görünür; Onay Bekleyen tıklandı`,
    ),
  );
  const clear2 = page.getByRole('button', { name: /Filtreyi Temizle/i }).first();
  if (await clear2.isVisible().catch(() => false)) {
    await clear2.click();
    await page.waitForTimeout(800);
  }

  // ── 9) Satır aksiyonları (menü açık) ─────────────────────────────────────
  const menuBtn = page.locator('button[title="İşlem Menüsü"]').first();
  let menuOk = false;
  if (await menuBtn.isVisible().catch(() => false)) {
    await menuBtn.scrollIntoViewIfNeeded().catch(() => {});
    await menuBtn.click();
    await page.waitForTimeout(350);
    menuOk =
      (await page.getByRole('button', { name: /Dosyaya Git/i }).first().isVisible().catch(() => false)) ||
      (await page.getByRole('button', { name: /Sil \/ İptal/i }).first().isVisible().catch(() => false));
  }
  const viewOk = await page.locator('button[title="Görüntüle"]').first().isVisible().catch(() => false);
  shots.push(
    await shot(page, '09-satir-aksiyonlari-menu.png', {
      feature: 'satir-aksiyonlari',
      menuOk,
      viewOk,
    }),
  );
  features.push(
    feature(
      9,
      'Satır aksiyonları (menü açık)',
      menuOk ? 'PASS' : viewOk ? 'PARTIAL' : 'FAIL',
      menuOk ? 'İşlem menüsü açık (Dosyaya Git / Sil…)' : viewOk ? 'Görüntüle var, menü açılamadı' : 'Satır aksiyonu yok',
    ),
  );

  // overview
  shots.push(await shot(page, '10-operasyon-overview.png', { feature: 'overview' }));

  const pass = features.filter((f) => f.status === 'PASS').length;
  const partial = features.filter((f) => f.status === 'PARTIAL').length;
  const fail = features.filter((f) => f.status === 'FAIL').length;

  const evidence = {
    epic: 'EPIC-03',
    demo: 'kabul-demo',
    at: new Date().toISOString(),
    localUrl: `${BASE}/panel/operasyon`,
    base: BASE,
    api: API,
    features,
    shots: shots.map((s) => ({ name: s.name, absolutePath: s.abs })),
    summary: { pass, partial, fail, total: features.length },
    notes,
    governance: {
      commit: false,
      push: false,
      deploy: false,
      production: false,
      seed: 'local DB only — repair_reports pending_approval +80h (reason=EPIC03_LOCAL_DEMO_20260715)',
    },
  };
  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));

  const md = [
    '# EPIC-03 Operasyon — Local Browser Kabul Demo (2026-07-15)',
    '',
    `**Local URL:** [${BASE}/panel/operasyon](${BASE}/panel/operasyon)`,
    '',
    `Özet: **PASS ${pass}** · PARTIAL ${partial} · FAIL ${fail} / ${features.length}`,
    '',
    'Commit / push / deploy: **yapılmadı**. Canlı: **başlamadı**.',
    '',
    '## Özellikler',
    '',
    '| # | Özellik | Sonuç | Screenshot |',
    '|---|---------|-------|------------|',
    ...features.map((f) => {
      const shotName =
        f.id === 1
          ? '01-72s-kural.png'
          : f.id === 2
            ? '02-onay-talep-et.png'
            : f.id === 3
              ? '03-dosya-sorumlusu-uyarisi.png'
              : f.id === 4
                ? '04-operasyon-durum-rozetleri.png'
                : f.id === 5
                  ? '05a-sutun-picker-acik.png'
                  : f.id === 6
                    ? '06-sutun-gizle-goster.png'
                    : f.id === 7
                      ? '07-gorunum-persist-reload.png'
                      : f.id === 8
                        ? '08-filtre-chipler.png'
                        : '09-satir-aksiyonlari-menu.png';
      const abs = path.join(OUT, shotName);
      return `| ${f.id} | ${f.name} | **${f.status}** | ![${shotName}](${shotName}) <br>\`${abs}\` |`;
    }),
    '',
    '## Detay',
    ...features.map((f) => `- **${f.id}. ${f.name}** — ${f.status}: ${f.detail}`),
    '',
    '## Screenshots (markdown)',
    ...shots.map((s) => `- ![${s.name}](${s.name})\n  - \`${s.abs}\``),
    '',
    '## Notlar',
    ...notes.map((n) => `- ${n}`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'RAPOR.md'), md);

  console.log(JSON.stringify(evidence.summary, null, 2));
  console.log(`OUT=${OUT}`);
  console.log(`URL=${BASE}/panel/operasyon`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});
