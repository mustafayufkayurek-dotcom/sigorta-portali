/**
 * D3XX Revizyon-3 kanıt: liste ikonları + drawer sekmeleri
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(
  __dirname,
  '../../../docs/project-governance/canli-kabul/ekran-goruntuleri/eksper-dosyalarim-d3xx-revizyon3-20260726',
);
const WEB = process.env.WEB_URL || 'http://localhost:3001';
const API = process.env.API_URL || 'http://localhost:3000/api/v1';
const EMAIL = 'eksper@meridyenasistans.com';
const PASS = 'Eksper123!';
const FILE_ID = '8757467a-a32d-4068-ae6c-3c927afccf3f';

mkdirSync(OUT, { recursive: true });

async function login(page) {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { email: EMAIL, password: PASS },
  });
  const body = await res.json();
  const tokens = body?.data?.tokens || {};
  const user = body?.data?.user;
  const access = tokens.accessToken;
  if (!access) throw new Error('Login failed');
  await page.goto(`${WEB}/giris`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ access, refresh, user }) => {
      localStorage.setItem('accessToken', access);
      localStorage.setItem('token', access);
      if (refresh) localStorage.setItem('refreshToken', refresh);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { access, refresh: tokens.refreshToken, user },
  );
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await login(page);
  await page.goto(`${WEB}/panel/eksper-portal/dosyalar`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="eksper-dosyalar-table"]', { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, '01-liste-ikonlar-1440.png'), fullPage: true });

  await page.goto(`${WEB}/panel/eksper-portal/dosyalar?fileId=${FILE_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="eksper-file-detail-drawer"]', { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, '02-drawer-ozet-1440.png'), fullPage: false });

  await page.getByRole('button', { name: 'Operasyon Bilgileri' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, '03-drawer-operasyon-bilgileri-1440.png'), fullPage: false });

  await page.getByRole('button', { name: 'Belgeler' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '04-drawer-belgeler-1440.png'), fullPage: false });

  const evidence = {
    capturedAt: new Date().toISOString(),
    web: WEB,
    fileId: FILE_ID,
    icons: [
      '/design-system/icons/dahili_su.svg',
      '/design-system/icons/yangin.svg',
      '/design-system/icons/cam_kirilmasi.svg',
    ],
    notes: [
      'Liste hasar ikonları SVG mask ile bağlandı',
      'Drawer başlık: Dosya Operasyon Özeti',
      'Sekme: Operasyon Bilgileri (Geçmiş yerine)',
      'Konut için Hasar Kalemleri + Finansal Özet',
    ],
  };
  writeFileSync(join(OUT, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  console.log('OK', OUT);
} finally {
  await browser.close();
}
