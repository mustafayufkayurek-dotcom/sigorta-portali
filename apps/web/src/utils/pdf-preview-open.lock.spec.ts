/**
 * Kilit: Hasar PDF önizlemesi blob adresini noopener ile açmaz.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/pdf-preview-open.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { openBlobUrlWithoutNoopener, readPdfPreviewFailure } from './pdf-preview-open.ts';

const here = dirname(fileURLToPath(import.meta.url));
const reportPage = readFileSync(
  join(here, '../app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx'),
  'utf8',
);
const helper = readFileSync(join(here, 'pdf-preview-open.ts'), 'utf8');

describe('hasar pdf önizleme LOCK', () => {
  it('rapor sayfası önizlemeyi yardımcıdan açar; noopener yok', () => {
    assert.match(reportPage, /presentPdfPreview\(/);
    assert.match(reportPage, /readPdfPreviewFailure\(/);
    assert.doesNotMatch(reportPage, /window\.open\(url, '_blank', 'noopener,noreferrer'\)/);
  });

  it('müşteri görünümü raporu aynı sayfada açar; yeni sekmeye bağlanmaz', () => {
    const from = helper.indexOf('export async function presentPdfPreview');
    const fn = helper.slice(from, from + 900);
    assert.match(fn, /mountPdfPreviewPanel/);
  });

  it('yardımcı blob adresine noopener vermez; kesilince sayfada Kapat durur', () => {
    assert.match(helper, /window\.open\(targetUrl, target\)/);
    assert.doesNotMatch(helper, /window\.open\([^)]*noopener/);
    assert.match(helper, /textContent = 'Kapat'/);
    assert.match(helper, /isPdfMagic/);
    assert.match(helper, /toPdfPreviewBlob/);
  });

  it('noopener fırlatan tarayıcıda üçüncü argümansız açılır', () => {
    let featuresSeen = false;
    const opened = openBlobUrlWithoutNoopener('blob:rapor', ((url, target, features) => {
      if (features && String(features).includes('noopener')) {
        featuresSeen = true;
        throw new Error('Unable to open a window with invalid URL');
      }
      assert.equal(url, 'blob:rapor');
      assert.equal(target, '_blank');
      return { opener: {} } as Window;
    }) as (url: string, target: string) => Window | null);
    assert.equal(featuresSeen, false);
    assert.ok(opened);
    assert.equal(opened?.opener, null);
  });

  it('içerik türü pdf yazmasa da %PDF gövdeyi kabul eder', async () => {
    const blob = new Blob(['%PDF-1.4 örnek'], { type: 'application/octet-stream' });
    assert.equal(await readPdfPreviewFailure(blob, 'application/octet-stream'), null);
  });

  it('içerik türü boş olsa da bayt imzası PDF kabul eder', async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    assert.equal(await readPdfPreviewFailure(blob, ''), null);
  });

  it('dizi tamponu gelen raporu JSON sanmaz', async () => {
    const buf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]).buffer;
    assert.equal(await readPdfPreviewFailure(buf, 'application/octet-stream'), null);
  });

  it('büyük ikili gövdeyi hata yazısı saymaz', async () => {
    const body = new Uint8Array(2_000);
    body[0] = 0x00;
    const blob = new Blob([body], { type: 'application/octet-stream' });
    assert.equal(await readPdfPreviewFailure(blob, 'application/octet-stream'), null);
  });

  it('sunucu hata yazısını olduğu gibi bırakır', async () => {
    const blob = new Blob([JSON.stringify({ message: 'PDF oluşturulamadı.' })], { type: 'application/json' });
    assert.equal(await readPdfPreviewFailure(blob, 'application/json'), 'PDF oluşturulamadı.');
  });

  it('oturum dosyası açan yerler aynı kapıyı kullanır', () => {
    const mustUse = [
      ['utils/fileDocumentApi.ts', /openSessionBlob\(/],
      ['utils/emergencyApi.ts', /openSessionBlob\(/],
      ['components/smart-measures/open-smart-measure-pdf.ts', /openSessionBlob\(/],
      ['components/eksper-portal/ExpertFileModals.tsx', /presentPdfPreview\(/],
      ['components/finance/HasarFileHakedisPanel.tsx', /presentPdfPreview\(/],
      ['components/EntityDocumentsTab.tsx', /openSessionBlob\(/],
      ['components/finance/FinanceRowActions.tsx', /openSessionBlob\(/],
    ] as const;
    for (const [rel, pattern] of mustUse) {
      const src = readFileSync(join(here, '..', rel), 'utf8');
      assert.match(src, pattern, rel);
    }
  });

  it('blob adresine noopener ile pencere açan kod kalmaz', () => {
    const hits = blobNoopenerHits(join(here, '..'));
    assert.deepEqual(hits, []);
  });

  it('indirme, puantaj, dekont ve eksper evrakı aynı kapıdadır', () => {
    assert.doesNotMatch(reportPage, /!contentType\.includes\('pdf'\)/);
    const puantaj = readFileSync(join(here, '../components/hr/AttendanceAccountantPanel.tsx'), 'utf8');
    assert.match(puantaj, /openSessionBlob\(blob, 'Puantaj'\)/);
    assert.doesNotMatch(puantaj, /window\.open\(''/);
    const finans = readFileSync(
      join(here, '../app/panel/hasar-dosyalari/[id]/_components/tabs/finans-subtabs.tsx'),
      'utf8',
    );
    const tedarikci = readFileSync(join(here, '../app/panel/tedarikciler/[id]/page.tsx'), 'utf8');
    for (const src of [finans, tedarikci]) {
      assert.match(src, /payments\/\$\{paymentId\}\/receipt\/file/);
      assert.match(src, /openSessionBlob\(/);
      assert.doesNotMatch(src, /receipt\/download/);
    }
    const eksper = readFileSync(join(here, '../components/eksper-portal/ExpertFileModals.tsx'), 'utf8');
    const drawer = readFileSync(join(here, '../components/eksper-portal/ExpertFileDetailDrawer.tsx'), 'utf8');
    for (const src of [eksper, drawer]) {
      assert.match(src, /uploads\/file\?storageKey=/);
      assert.match(src, /openSessionBlob\(/);
      assert.doesNotMatch(src, /uploads\/signed-url/);
    }
    const pay = readFileSync(
      join(here, '../../../../apps/backend/src/modules/payments/payments.controller.ts'),
      'utf8',
    );
    assert.match(pay, /payments\/:id\/receipt\/file/);
    assert.match(pay, /res\.send\(buffer\)/);
  });

  it('canlı alım bu kilidi atlayamaz', () => {
    const smoke = readFileSync(join(here, '../../../../scripts/smoke-canli-bitmis-is.sh'), 'utf8');
    assert.match(smoke, /pdf-preview-open\.lock\.spec\.ts/);
  });
});

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function blobNoopenerHits(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.endsWith('.lock.spec.ts')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      blobNoopenerHits(path, acc);
      continue;
    }
    if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue;
    if (name === 'pdf-preview-open.ts') continue;
    const src = stripComments(readFileSync(path, 'utf8'));
    if (/URL\.createObjectURL[\s\S]{0,500}?\.rel\s*=\s*['"]noopener/.test(src)) {
      acc.push(path);
      continue;
    }
    const callRe = /window\.open\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = callRe.exec(src))) {
      const args = match[1] ?? '';
      if (!args.includes('noopener')) continue;
      const arg = args.split(',')[0]?.trim() ?? '';
      if (!/^[A-Za-z_$][\w$]*$/.test(arg)) continue;
      const before = src.slice(Math.max(0, match.index - 900), match.index);
      const assigned = new RegExp(`(?:const|let|var)\\s+${arg}\\s*=\\s*URL\\.createObjectURL|${arg}\\s*=\\s*URL\\.createObjectURL`);
      if (assigned.test(before)) {
        acc.push(path);
        break;
      }
    }
  }
  return acc;
}
