/**
 * FAZ-0 — Sigorta ve Asistans Firmaları · 2 sekme onaylı görünüm (2026-07-18)
 *
 * Kendi kendine yeten kanıt betiği:
 *   1. `next dev` başlatır (kendi portu),
 *   2. Panel API çağrılarını Playwright ile mock'lar (backend gerekmez),
 *   3. Asistans sekmesini render edip ekran görüntüsü alır,
 *   4. dev sunucusunu kapatır.
 *
 *   node scripts/capture-faz0-sigorta-asistans-sekme-20260718.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(WEB_DIR, '../..');
const PORT = Number(process.env.CAPTURE_PORT || 3044);
const BASE = `http://localhost:${PORT}`;
const API_HOST = 'http://127.0.0.1:3999/api/v1';
const OUT = path.join(
  ROOT,
  'docs/project-governance/canli-kabul/ekran-goruntuleri/faz0-sigorta-asistans-sekme-20260718',
);
fs.mkdirSync(OUT, { recursive: true });

const nowIso = new Date().toISOString();

const SAMPLE_COMPANIES = [
  {
    id: 'ins-1', code: 'SGK-001', name: 'Anadolu Sigorta A.Ş.', taxNumber: '1234567890',
    contactEmail: 'operasyon@anadolusigorta.com.tr', contactPhone: '0212 350 00 00',
    address: 'Kültür Mah. Kolektif Cad. No: 12, Şişli/İstanbul', status: 'active', notes: null, createdAt: nowIso,
  },
  {
    id: 'ins-2', code: 'SGK-002', name: 'Allianz Sigorta A.Ş.', taxNumber: '9876543210',
    contactEmail: 'hasar@allianz.com.tr', contactPhone: '0850 399 99 99',
    address: 'Maslak Mah. Büyükdere Cad., Sarıyer/İstanbul', status: 'active', notes: null, createdAt: nowIso,
  },
];

const SAMPLE_FIRMS = [
  {
    id: 'asi-1', companyName: 'Meridyen Yol Yardım A.Ş.', taxNumber: null,
    email: 'destek@meridyenyol.com', phone: '0850 000 11 22', city: 'İstanbul',
    address: 'Ataşehir Mah. Barbaros Cad. No: 5', notes: null, status: 'active', createdAt: nowIso,
  },
  {
    id: 'asi-2', companyName: 'Doğuş Asistans Hizmetleri', taxNumber: null,
    email: 'cagri@dogusasistans.com', phone: '0212 444 33 22', city: 'Ankara',
    address: 'Çankaya Mah. Atatürk Bulvarı No: 40', notes: null, status: 'active', createdAt: nowIso,
  },
  {
    id: 'asi-3', companyName: 'Eski Asistans Ltd.', taxNumber: null,
    email: null, phone: '0232 111 22 33', city: 'İzmir',
    address: null, notes: null, status: 'passive', createdAt: nowIso,
  },
];

const ADMIN_USER = {
  id: 'admin-user', firstName: 'Sistem', lastName: 'Yöneticisi',
  email: 'admin@meridyenassistance.com', role: { code: 'admin', name: 'Yönetici' },
  mustChangePassword: false,
};

const ALLOWED_SCREENS = [
  'dashboard', 'hasar_dosyalari', 'acil_yardim', 'finans', 'operasyon', 'sahiplik',
  'crm', 'musteriler', 'tedarikciler', 'raporlar', 'ayarlar', 'kullanicilar',
  'guvenlik', 'harita', 'personel_yonetimi', 'personel_ozluk',
];

function waitForPort(port, timeoutMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error('dev server port timeout'));
        else setTimeout(tryConnect, 500);
      });
    };
    tryConnect();
  });
}

async function mockApi(page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    const json = (data, meta) => route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(meta ? { data, meta } : { data }),
    });
    if (url.includes('/auth/me')) return json(ADMIN_USER);
    if (url.includes('/users/me/permissions')) return json({ screens: ALLOWED_SCREENS });
    if (url.includes('/agreements/pending')) return json([]);
    if (url.includes('/notifications/unread-count')) return json({ count: 0 });
    if (url.includes('/notifications')) return json([]);
    if (url.includes('/system-settings/company-info')) return json({ name: 'Meridyen Assistance' });
    if (url.includes('/health')) {
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ok', maintenanceMode: false }) });
    }
    if (url.includes('/revision-requests')) return json([], { total: 0 });
    if (url.includes('/operation-inbox/stats')) return json({ pending: 0, unownedCount: 0 });
    if (url.includes('/insurance-companies')) return json(SAMPLE_COMPANIES);
    if (url.includes('/customers')) return json(SAMPLE_FIRMS);
    return json([], { total: 0 });
  });
}

async function injectAuth(page) {
  await page.addInitScript((user) => {
    const now = Date.now();
    try {
      sessionStorage.setItem('meridyenBrowserSession', '1');
      sessionStorage.setItem('meridyenAuthTab', '1');
      localStorage.setItem('accessToken', 'capture-token');
      localStorage.setItem('refreshToken', 'capture-refresh');
      localStorage.setItem('meridyenRememberMe', '1');
      localStorage.setItem('authPersistence', 'remember');
      localStorage.setItem('tokenExpiry', String(now + 7 * 24 * 60 * 60 * 1000));
      localStorage.setItem('meridyenLastAuthActivity', String(now));
      localStorage.setItem('rememberedEmail', user.email);
      localStorage.setItem('user', JSON.stringify(user));
    } catch {}
  }, ADMIN_USER);
}

async function main() {
  console.log('dev server başlatılıyor...');
  const dev = spawn('pnpm', ['exec', 'next', 'dev', '-p', String(PORT)], {
    cwd: WEB_DIR,
    env: { ...process.env, NEXT_PUBLIC_API_URL: API_HOST },
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const cleanup = () => { try { dev.kill('SIGKILL'); } catch {} };
  process.on('exit', cleanup);

  try {
    await waitForPort(PORT);
    console.log('port hazır, uygulama derleniyor...');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await mockApi(page);
    await injectAuth(page);

    // Asistans sekmesi
    await page.goto(`${BASE}/panel/ayarlar/sigorta-sirketleri?tab=asistans`, {
      waitUntil: 'domcontentloaded', timeout: 180000,
    });
    await page.waitForTimeout(2500);
    // Sekme başlığının render olmasını bekle
    await page.waitForFunction(() => document.body.innerText.includes('Sigorta ve Asistans'), { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const checks = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        title: /Sigorta ve Asistans/.test(text),
        tabSigorta: /Sigorta Şirketleri/.test(text),
        tabAsistans: /Asistans Firmaları/.test(text),
        asistansFilters: /Tümü/.test(text) && /Aktif/.test(text) && /Pasif/.test(text),
        firmRow: /Meridyen Yol Yardım/.test(text),
        vergiNoHeaderPresent: /Vergi No/.test(text),
      };
    });
    fs.writeFileSync(path.join(OUT, 'EVIDENCE.json'), JSON.stringify({ at: nowIso, checks }, null, 2));
    console.log('checks', checks);

    await page.screenshot({ path: path.join(OUT, '04-onayli-iki-sekme.png'), fullPage: false });

    // Ek: Yeni Asistans Firması modalı (Durum alanı + Vergi No yok kanıtı)
    const addBtn = page.getByRole('button', { name: /Yeni Asistans Firması/ });
    if (await addBtn.count()) {
      await addBtn.first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, '05-asistans-form-durum.png'), fullPage: false });
    }

    await browser.close();
    console.log('OUT', OUT);
  } finally {
    cleanup();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
