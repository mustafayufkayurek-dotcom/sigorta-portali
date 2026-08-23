/**
 * Kilit: Hasar Evraklar — tür seçerek manuel Muvafakatname / Anket Formu yükleme.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/hasar-dosyalari/evrak-manuel-yukle.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const specDir = dirname(fileURLToPath(import.meta.url));
const webSrc = join(specDir, '../../..');
const panel = readFileSync(
  join(webSrc, 'components/file-documents/ClaimManualDocumentsPanel.tsx'),
  'utf8',
);
const ozet = readFileSync(
  join(specDir, '[id]/_components/tabs/EvrakOzetPanel.tsx'),
  'utf8',
);
const api = readFileSync(join(webSrc, 'utils/fileDocumentApi.ts'), 'utf8');
const controller = readFileSync(
  join(specDir, '../../../../../backend/src/modules/file-documents/file-documents.controller.ts'),
  'utf8',
);

describe('hasar manuel evrak yükleme LOCK', () => {
  it('Özet ekranında Manuel Evrak Yükle paneli durur', () => {
    assert.match(ozet, /ClaimManualDocumentsPanel/);
    assert.match(panel, /Manuel Evrak Yükle/);
  });

  it('yüklemeden önce Muvafakatname veya Anket Formu seçilir', () => {
    assert.match(panel, /Muvafakatname/);
    assert.match(panel, /Anket Formu/);
    assert.match(panel, /Önce evrak türünü seçin/);
    assert.match(panel, /disabled=\{uploading \|\| !kind\}/);
  });

  it('Operasyon toplama Evraklar altındadır, dosya Operasyon gövdesinde yükleme yok', () => {
    const tab = readFileSync(
      join(specDir, '[id]/_components/tabs/EvraklarTab.tsx'),
      'utf8',
    );
    const page = readFileSync(join(specDir, '[id]/page.tsx'), 'utf8');
    assert.match(tab, /id: 'toplanan'/);
    assert.match(tab, /Tespit Ve Onarım/);
    assert.match(tab, /OperasyonEvrakToplamaPanel/);
    assert.doesNotMatch(page, /OperasyonEvrakToplamaPanel/);
  });
});
