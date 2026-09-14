import * as fs from 'fs';
import * as puppeteer from 'puppeteer';

function uniqueExisting(paths: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    const value = (p || '').trim();
    if (!value || seen.has(value) || !fs.existsSync(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function chromeCandidates(): string[] {
  let bundled: string | undefined;
  try {
    bundled = puppeteer.executablePath();
  } catch {
    bundled = undefined;
  }
  return uniqueExisting([
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    bundled,
  ]);
}

async function renderPdf(executablePath: string, html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '14mm', left: '10mm', right: '10mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** HTML belgeden A4 PDF. Sistem Chrome önce denenir; hiçbiri açılmazsa null. */
export async function htmlDocumentToPdf(html: string): Promise<Buffer | null> {
  const candidates = chromeCandidates();
  if (!candidates.length) return null;
  for (const executablePath of candidates) {
    try {
      return await renderPdf(executablePath, html);
    } catch {
      /* sonraki tarayıcı */
    }
  }
  return null;
}
