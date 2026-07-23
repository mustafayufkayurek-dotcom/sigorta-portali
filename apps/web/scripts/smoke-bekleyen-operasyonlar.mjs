/**
 * Dosya Sorumlusu Bekleyen Operasyonlar — browser smoke
 * node apps/web/scripts/smoke-bekleyen-operasyonlar.mjs [BASE] [API] [EMAIL] [PASS] [OUT]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.argv[2] || process.env.CAPTURE_BASE || 'http://localhost:3001';
const API = process.argv[3] || process.env.CAPTURE_API || 'http://127.0.0.1:3000/api/v1';
const EMAIL = process.argv[4] || process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.argv[5] || process.env.LOGIN_PASSWORD || 'admin123';
const OUT = process.argv[6] || path.resolve('docs/project-governance/canli-kabul/ekran-goruntuleri/bekleyen-operasyonlar-smoke');

fs.mkdirSync(OUT, { recursive: true });

async function apiLogin() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  const data = loginJson?.data && typeof loginJson.data === 'object' ? loginJson.data : loginJson;
  const token = data?.accessToken || data?.tokens?.accessToken || '';
  const refresh = data?.tokens?.refreshToken || data?.refreshToken || '';
  const user = data?.user || null;
  if (!token) throw new Error(`API login failed: ${loginRes.status}`);
  return { token, refresh, user };
}

async function injectAuth(page, auth) {
  await page.goto(`${BASE}/giris`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(300);
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
      accessToken: auth.token,
      refreshToken: auth.refresh,
      userJson: auth.user ? JSON.stringify(auth.user) : '',
      email: EMAIL,
    },
  );
}

async function main() {
  const auth = await apiLogin();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await injectAuth(page, auth);

  // Office UX (dev demo) — production’da NODE_ENV=production → demo kapalı; office_staff gerçek rol gerekir
  await page.goto(`${BASE}/panel?demo=bekleyen-operasyonlar`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(5000);

  // Başlık h1 veya widget başlığı
  const heading = page.getByText('Dosya Sorumlusu Merkezi').first();
  await heading.waitFor({ state: 'visible', timeout: 45000 });
  const title = await heading.textContent();

  const section = page.locator('#bekleyen-operasyonlar');
  await section.waitFor({ state: 'visible', timeout: 30000 });

  const cards = section.locator('article');
  const cardCount = await cards.count();
  if (cardCount < 1 || cardCount > 5) {
    // İlk ekranda en fazla 5; en az 1 (boş değilse). Demo veri ile 5 beklenir.
    if (cardCount > 5) throw new Error(`İlk ekranda 5’ten fazla kart: ${cardCount}`);
  }

  const body = await section.innerText();
  if (!/Bekleyen Operasyon/i.test(body)) throw new Error('Bekleyen Operasyon satırı yok');
  if (/pending_approval|external_approval|submitted|workflow|enum/i.test(body)) {
    throw new Error('Teknik state/workflow metni ekranda görünüyor');
  }

  const cta = section.getByRole('link').filter({ hasText: /Hatırlat|Aktar|İncele|Talep Et|Devam Et/ }).first();
  await cta.waitFor({ state: 'visible', timeout: 10000 });

  // Açıklama ↔ buton hizası (görünen ilk kart)
  const firstCard = cards.first();
  const firstText = await firstCard.innerText();
  if (/Sigorta şirketinden onay bekleniyor/.test(firstText) && !/Sigortayı Hatırlat/.test(firstText)) {
    throw new Error('Açıklama/buton hizasız: sigorta');
  }
  if (/Eksperden rapor bekleniyor/.test(firstText) && !/Eksperi Hatırlat/.test(firstText)) {
    throw new Error('Açıklama/buton hizasız: eksper');
  }

  const showAll = page.getByRole('button', { name: /Tümünü Gör/i }).first();
  if (await showAll.isVisible().catch(() => false)) {
    const before = await cards.count();
    if (before > 5) throw new Error(`İlk ekranda 5’ten fazla kart: ${before}`);
    await showAll.click();
    await page.waitForTimeout(500);
    const after = await cards.count();
    if (after < before) throw new Error('Tümünü Gör sonrası kart sayısı azalmamalı');
  } else if (cardCount > 5) {
    throw new Error(`Tümünü Gör yok ama ${cardCount} kart var`);
  }

  await page.screenshot({ path: path.join(OUT, 'smoke-dosya-sorumlusu.png'), fullPage: true });

  // Yönetim dashboard (demo kapalı) — admin management layout
  await page.goto(`${BASE}/panel`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);
  const mgmtTitle = (await page.locator('h1').first().textContent()) || '';
  const hasPendingOpsPanel = await page.locator('#bekleyen-operasyonlar').count();
  // Admin → Yönetim Dashboard; Bekleyen Operasyonlar paneli olmamalı
  if (/Yönetim/i.test(mgmtTitle) && hasPendingOpsPanel > 0) {
    throw new Error('Yönetim Dashboard’da #bekleyen-operasyonlar sızıntısı');
  }
  await page.screenshot({ path: path.join(OUT, 'smoke-yonetim-veya-panel.png'), fullPage: false });

  const report = {
    ok: true,
    title: title?.trim(),
    focusCards: cardCount,
    managementTitle: mgmtTitle.trim(),
    pendingOpsOnManagement: hasPendingOpsPanel,
  };
  fs.writeFileSync(path.join(OUT, 'SMOKE.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
