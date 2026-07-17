/**
 * EPIC-05 — Önerilen Tedarikçiler sekmeleri (Kayıtlı / Alternatif)
 *
 *   CAPTURE_BASE=http://localhost:3001 CAPTURE_API=http://127.0.0.1:3000/api/v1 \
 *   node scripts/capture-epic05-tedarikci-sekmeler-20260717.mjs
 *
 * Kart alanlarını göstermek için recommended + alternative-search yanıtları
 * sayfa içinde mock edilir (yalnızca capture; production API değişmez).
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
      'docs/project-governance/canli-kabul/ekran-goruntuleri/epic05-tedarikci-sekmeler-20260717',
    ),
);
const EMAIL = process.env.LOGIN_EMAIL || 'admin@meridyenassistance.com';
const PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';
const SEED_EMERGENCY_ID = process.env.EMERGENCY_CASE_ID || 'f4624c59-30e9-4380-8ac9-abb2f0c36757';

fs.mkdirSync(OUT, { recursive: true });

const MOCK_KAYITLI = {
  data: [
    {
      id: 'mock-vendor-1',
      name: 'Anadolu Yol Yardım',
      phone: '0532 111 22 33',
      city: 'İstanbul',
      district: 'Kadıköy',
      avgServiceScore: 4.6,
      avgCost: 1850,
      avgResponseTime: 0.75,
      completedFileCount: 42,
      compositeScore: 91.2,
      rank: 1,
      // distanceKm / lastWorkedAt yok → UI "—" (backend alanı yok)
    },
    {
      id: 'mock-vendor-2',
      name: 'Marmara Çekici',
      phone: '0533 444 55 66',
      city: 'İstanbul',
      district: 'Üsküdar',
      avgServiceScore: 4.2,
      avgCost: 2100,
      avgResponseTime: 1.2,
      completedFileCount: 28,
      compositeScore: 84.5,
      rank: 2,
    },
  ],
};

const MOCK_ALTERNATIF = {
  data: [
    {
      externalId: 'ext-1',
      name: 'Boğaziçi Oto Kurtarma',
      address: 'Bağdat Cad. No: 120',
      city: 'İstanbul',
      district: 'Kadıköy',
      phone: '0216 555 01 01',
      rating: 4.4,
      reviewCount: 128,
      serviceTypes: ['çekici'],
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Bogazici+Oto',
      websiteUrl: 'https://example.com',
    },
    {
      externalId: 'ext-2',
      name: 'Anadolu Acil Servis',
      address: 'Fahrettin Kerim Gökay Cad.',
      city: 'İstanbul',
      district: 'Üsküdar',
      phone: '0216 555 02 02',
      rating: 3.9,
      reviewCount: 54,
      serviceTypes: ['çekici'],
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Anadolu+Acil',
    },
  ],
  meta: {
    configured: true,
    code: 'OK',
    message: 'Öneriler hazır.',
    sessionId: 'capture-session',
    count: 2,
  },
};

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
  const list = await fetch(`${API}/emergency/cases?limit=40`, { headers });
  const json = await list.json().catch(() => ({}));
  const raw = json?.data?.items || json?.data || json?.items || [];
  const items = Array.isArray(raw) ? raw : [];
  const unassigned = items.find((c) => c?.id && !c?.assignedVendorId);
  if (unassigned?.id) {
    return { id: unassigned.id, source: `list-unassigned-${unassigned.status}`, status: unassigned.status };
  }
  if (items[0]?.id) {
    return { id: items[0].id, source: `list-first-${items[0].status}`, status: items[0].status };
  }
  return { id: SEED_EMERGENCY_ID, source: 'seed-fallback' };
}

async function main() {
  const auth = await apiLogin();
  const caseInfo = await resolveCase(auth.token);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Kart alanlarını kanıtlamak için öneri API’lerini mock’la
  await page.route('**/vendors/recommended**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_KAYITLI),
    });
  });
  await page.route('**/vendor-discovery/alternative-search**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ALTERNATIF),
    });
  });

  await injectAuth(page, auth);
  await page.evaluate((caseId) => {
    localStorage.removeItem(`emergency-acil-flow:${caseId}`);
  }, caseInfo.id);

  await page.goto(`${BASE}/panel/acil-yardim/${caseInfo.id}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('[data-testid="acil-dosya-detay"]', { timeout: 45000 });
  await page.waitForSelector('[data-testid="tedarikci-sekmeler"]', { timeout: 20000 });
  await page.waitForSelector('[data-testid="tedarikci-oneri"]', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(800);

  const panel = page.locator('[data-testid="tedarikci-onerileri"]');
  await panel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // 01: Kayıtlı (varsayılan; mock ile dolu)
  await page.click('[data-testid="sekme-kayitli-tedarikciler"]');
  await page.waitForTimeout(500);
  const kayitliActive = await page.getAttribute('[data-testid="sekme-kayitli-tedarikciler"]', 'aria-selected');
  await panel.screenshot({ path: path.join(OUT, '01-kayitli-tab.png') });

  // 02: Alternatif Öneriler
  await page.click('[data-testid="sekme-alternatif-oneriler"]');
  await page.waitForSelector('[data-testid="alternatif-aday"]', { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(800);
  await panel.screenshot({ path: path.join(OUT, '02-alternatif-tab.png') });

  // Responsive: desktop zaten 1440; tablet + mobile vendor alanı
  const responsiveShots = [];
  for (const vp of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(350);
    await panel.scrollIntoViewIfNeeded();
    await page.click('[data-testid="sekme-kayitli-tedarikciler"]');
    await page.waitForTimeout(300);
    const kayitliName = `03-responsive-${vp.name}-kayitli.png`;
    await panel.screenshot({ path: path.join(OUT, kayitliName) });
    await page.click('[data-testid="sekme-alternatif-oneriler"]');
    await page.waitForTimeout(300);
    const altName = `04-responsive-${vp.name}-alternatif.png`;
    await panel.screenshot({ path: path.join(OUT, altName) });
    responsiveShots.push(kayitliName, altName);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // Kayıtlı sekme kanıtı (Havuza Kaydet / Havuzda olmamalı)
  await page.click('[data-testid="sekme-kayitli-tedarikciler"]');
  await page.waitForTimeout(400);
  const kayitliText = await panel.innerText();
  const kayitliHasHavuzBtn = /Havuza Kaydet|Havuzda/i.test(kayitliText);
  const hasSistemOnerisi = await page.locator('[data-testid="tedarikci-sistem-onerisi"]').count();
  const hasRationaleLabels =
    /Hizmet Kalitesi/i.test(kayitliText)
    && /Bölgeye Uzaklık/i.test(kayitliText)
    && /Ortalama Maliyet/i.test(kayitliText)
    && /Tamamlanan Dosya Sayısı/i.test(kayitliText)
    && /Son Çalışma Tarihi/i.test(kayitliText);

  await page.click('[data-testid="sekme-alternatif-oneriler"]');
  await page.waitForTimeout(400);
  const alternatifText = await panel.innerText();
  const hasFirmaAdi = /Firma Adı/i.test(alternatifText);
  const hasHavuzaKaydet = /Havuza Kaydet/i.test(alternatifText);
  const evidence = {
    caseId: caseInfo.id,
    source: caseInfo.source,
    status: caseInfo.status,
    mockedCards: true,
    defaultTabKayitli: kayitliActive === 'true',
    hasSekmeler: true,
    tabLabels: {
      kayitli: (await page.locator('[data-testid="sekme-kayitli-tedarikciler"]').innerText()).trim(),
      alternatif: (await page.locator('[data-testid="sekme-alternatif-oneriler"]').innerText()).trim(),
    },
    forbiddenGoogleInUi: !/\bgoogle\b|\bplaces\b|\bapi\b/i.test(alternatifText),
    kayitliOnlyDosyayaAta: /Dosyaya Ata/i.test(kayitliText) && !kayitliHasHavuzBtn,
    kayitliNoHavuzButton: !kayitliHasHavuzBtn,
    hasSistemOnerisi: hasSistemOnerisi > 0,
    hasRationaleLabels,
    hasDosyayaAtaOrEmpty: /Dosyaya Ata|Havuza Kaydet/i.test(alternatifText),
    hasFirmaAdi,
    hasPuan: /Puan/i.test(alternatifText),
    hasDegerlendirme: /Değerlendirme Sayısı/i.test(alternatifText),
    hasYolTarifi: /Yol Tarifi/i.test(alternatifText),
    alternatifHasHavuzaKaydet: hasHavuzaKaydet,
    screenshots: ['01-kayitli-tab.png', '02-alternatif-tab.png', ...responsiveShots],
  };
  fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));

  console.log(JSON.stringify({ ok: true, out: OUT, evidence }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
