#!/usr/bin/env node
/**
 * Meridyen Assistance — Doküman PDF Üretici
 *
 * Kullanım:
 *   node scripts/generate-docs-pdf.js
 *
 * Çıktı:
 *   apps/web/public/docs/01-personel-kullanim-kilavuzu.pdf
 *   apps/web/public/docs/02-satis-pazarlama.pdf
 *   apps/web/public/docs/03-eksper-portal-tanitim.pdf
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'apps', 'web', 'public', 'docs');

const DOCS = [
  {
    html: path.join(DOCS_DIR, '01-personel-kullanim-kilavuzu.html'),
    pdf:  path.join(DOCS_DIR, '01-personel-kullanim-kilavuzu.pdf'),
    name: 'Meridyen Hasar Yönetim Platformu Kullanım Kılavuzu (Personel)',
  },
  {
    html: path.join(DOCS_DIR, '02-sigorta-portal-kilavuzu.html'),
    pdf:  path.join(DOCS_DIR, '02-sigorta-portal-kilavuzu.pdf'),
    name: 'Meridyen Hasar Yönetim Platformu Kullanım Kılavuzu (Sigorta Şirketi)',
  },
  {
    html: path.join(DOCS_DIR, '04-broker-portal-kilavuzu.html'),
    pdf:  path.join(DOCS_DIR, '04-broker-portal-kilavuzu.pdf'),
    name: 'Meridyen Hasar Yönetim Platformu Kullanım Kılavuzu (Broker)',
  },
  {
    html: path.join(DOCS_DIR, '02-satis-pazarlama.html'),
    pdf:  path.join(DOCS_DIR, '02-satis-pazarlama.pdf'),
    name: 'Satış ve Pazarlama Broşürü',
  },
  {
    html: path.join(DOCS_DIR, '03-eksper-portal-tanitim.html'),
    pdf:  path.join(DOCS_DIR, '03-eksper-portal-tanitim.pdf'),
    name: 'Meridyen Hasar Yönetim Platformu Kullanım Kılavuzu (Eksper)',
  },
];

(async () => {
  // Puppeteer'i bul — monorepo backend node_modules'ünü kullan
  const candidates = [
    path.join(ROOT, 'apps', 'backend', 'node_modules', 'puppeteer'),
    path.join(ROOT, 'node_modules', 'puppeteer'),
  ];

  let puppeteerPath = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      puppeteerPath = candidate;
      break;
    }
  }

  if (!puppeteerPath) {
    console.error('Puppeteer bulunamadı. Lütfen: npm install puppeteer');
    process.exit(1);
  }

  const pptr = require(puppeteerPath);

  const chromeCandidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);

  let executablePath;
  for (const candidate of chromeCandidates) {
    if (fs.existsSync(candidate)) {
      executablePath = candidate;
      break;
    }
  }

  console.log('PDF üretimi başlıyor...\n');

  const browser = await pptr.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
    ],
  });

  for (const doc of DOCS) {
    if (!fs.existsSync(doc.html)) {
      console.error(`  HATA: Kaynak HTML bulunamadı: ${doc.html}`);
      continue;
    }

    process.stdout.write(`  ${doc.name} ... `);

    const page = await browser.newPage();

    await page.goto(`file://${doc.html}`, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.pdf({
      path: doc.pdf,
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      displayHeaderFooter: false,
    });

    await page.close();

    const sizeKb = Math.round(fs.statSync(doc.pdf).size / 1024);
    console.log(`OK (${sizeKb} KB) → ${path.relative(ROOT, doc.pdf)}`);
  }

  await browser.close();

  console.log('\nTüm PDF dosyaları başarıyla oluşturuldu.');
  console.log(`Konum: ${DOCS_DIR}`);
})().catch((err) => {
  console.error('\nBeklenmeyen hata:', err.message);
  process.exit(1);
});
