/**
 * Mesaj Şablonları — sade enterprise görünüm kanıtı (2026-07-18)
 * node scripts/capture-mesaj-sablonlari-sade-20260718.mjs
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
const PORT = Number(process.env.CAPTURE_PORT || 3055);
const BASE = `http://localhost:${PORT}`;
const API_HOST = 'http://127.0.0.1:3999/api/v1';
const OUT = path.join(
  ROOT,
  'docs/project-governance/canli-kabul/ekran-goruntuleri/mesaj-sablonlari-20260718',
);
fs.mkdirSync(OUT, { recursive: true });

const ADMIN_USER = {
  id: 'admin-user',
  firstName: 'Mustafa',
  lastName: 'Yönetici',
  email: 'admin@meridyenassistance.com',
  role: { code: 'admin', name: 'Yönetici' },
  mustChangePassword: false,
};

const ALLOWED_SCREENS = [
  'dashboard', 'hasar_dosyalari', 'acil_yardim', 'finans', 'operasyon', 'sahiplik',
  'crm', 'musteriler', 'tedarikciler', 'raporlar', 'ayarlar', 'kullanicilar',
  'guvenlik', 'harita', 'personel_yonetimi', 'personel_ozluk',
];

const TEMPLATES = {
  whatsapp_acil_ilk_bilgilendirme: {
    id: 'tpl-acil-ilk',
    type: 'whatsapp_acil_ilk_bilgilendirme',
    name: 'Sigortalıya İlk Bilgilendirme',
    isActive: true,
    content: 'Değerli Sigortalımız,\n\nAcil Yardım dosyanız (Dosya No: {Dosya No}) tarafımıza ulaşmış olup, dosya sorumlumuz {Dosya Sorumlusu} en kısa sürede sizinle irtibata geçecektir.\n\nDosya Konusu: {Dosya Konusu}\nDosya Sorumlusu Tlf: {Dosya Sorumlusu Telefon}\n\nSaygılarımızla,\nMeridyen Assistance',
  },
  whatsapp_acil_kapanis_anket: {
    id: 'tpl-acil-kapanis',
    type: 'whatsapp_acil_kapanis_anket',
    name: 'Kapanış / Anket Mesajı',
    isActive: true,
    content: 'Değerli {Sigortalı Ad},\n\nAcil Yardım dosyanız ({Dosya No}) kapanmıştır.',
  },
  whatsapp_vendor_assignment: {
    id: 'tpl-vendor',
    type: 'whatsapp_vendor_assignment',
    name: 'Tedarikçi Atama Mesajı',
    isActive: true,
    content: 'Sayın {tedarikciAdi}, {dosyaNo} dosyası için görevlendirme yapılmıştır.',
  },
  sms_assignment: {
    id: 'tpl-sms',
    type: 'sms_assignment',
    name: 'Dosya Atama SMS',
    isActive: true,
    content: 'Sayın {musteriAdi}, {dosyaNo} dosyanız {sirketAdi} tarafından işleme alınmıştır.',
  },
};

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
  await page.route('**/*api/v1/**', async (route) => {
    const url = route.request().url();
    const raw = (data) => route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const wrapped = (data, meta) => raw(meta ? { data, meta } : { data });

    if (url.includes('/auth/me')) return wrapped(ADMIN_USER);
    if (url.includes('/users/me/permissions')) return wrapped({ screens: ALLOWED_SCREENS });
    if (url.includes('/agreements/pending')) return wrapped([]);
    if (url.includes('/notifications/unread-count')) return wrapped({ count: 0 });
    if (url.includes('/notifications') && !url.includes('/sms')) return wrapped([]);
    if (url.includes('/system-settings/company-info')) return wrapped({ name: 'Meridyen Assistance' });
    if (url.includes('/health')) {
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'ok', maintenanceMode: false }),
      });
    }
    if (url.includes('/revision-requests')) return wrapped([], { total: 0 });
    if (url.includes('/operation-inbox/stats')) return wrapped({ pending: 0, unownedCount: 0 });

    const tplMatch = url.match(/\/notifications\/sms\/templates\/([^/?]+)/);
    if (tplMatch) {
      const type = decodeURIComponent(tplMatch[1]);
      const tpl = TEMPLATES[type] || {
        id: type, type, name: type, isActive: true, content: '',
      };
      return raw(tpl);
    }
    if (url.includes('/notifications/sms/logs')) return raw([]);
    return wrapped([], { total: 0 });
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
  try {
    const { execSync } = await import('child_process');
    execSync(`lsof -tiTCP:${PORT} -sTCP:LISTEN | xargs kill -9`, { stdio: 'ignore' });
  } catch {}

  console.log('dev server başlatılıyor...');
  const dev = spawn('pnpm', ['exec', 'next', 'dev', '-p', String(PORT)], {
    cwd: WEB_DIR,
    env: { ...process.env, NEXT_PUBLIC_API_URL: API_HOST, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const cleanup = () => { try { dev.kill('SIGKILL'); } catch {} };
  process.on('exit', cleanup);

  try {
    await waitForPort(PORT);
    const browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await mockApi(page);
    await injectAuth(page);

    await page.goto(`${BASE}/panel/ayarlar/sms-bildirimler`, {
      waitUntil: 'domcontentloaded',
      timeout: 180000,
    });
    await page.waitForTimeout(4000);

    const debug = await page.evaluate(() => ({
      url: location.href,
      text: (document.body?.innerText || '').slice(0, 900),
    }));
    console.log('URL:', debug.url);
    console.log('PAGE:', debug.text.replace(/\s+/g, ' ').slice(0, 500));
    fs.writeFileSync(path.join(OUT, 'DEBUG.txt'), `${debug.url}\n\n${debug.text}`);

    // Ne gelirse gelsin kanıt al (giriş sayfası olsa bile)
    await page.screenshot({ path: path.join(OUT, '06-sade-acil.png'), fullPage: false });

    if (!/Mesaj Şablonları/.test(debug.text)) {
      throw new Error('Mesaj Şablonları ekranı açılmadı — DEBUG.txt ve 06-sade-acil.png kontrol et');
    }

    fs.copyFileSync(path.join(OUT, '06-sade-acil.png'), path.join(OUT, '01-liste.png'));

    await page.getByRole('button', { name: 'Hasar', exact: true }).click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, '07-sade-hasar.png'), fullPage: false });

    await page.getByRole('button', { name: 'Acil Yardım', exact: true }).click();
    await page.waitForTimeout(500);
    const edit = page.locator('table tbody tr').first().locator('button').first();
    if (await edit.count()) {
      await edit.click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, '08-sade-duzenle.png'), fullPage: false });
      fs.copyFileSync(path.join(OUT, '08-sade-duzenle.png'), path.join(OUT, '02-duzenle-modal.png'));
    }

    console.log('OK', OUT);
    await browser.close();
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
