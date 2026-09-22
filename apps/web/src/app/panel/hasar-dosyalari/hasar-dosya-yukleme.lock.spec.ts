/**
 * Hasar dosya yüklemede kabuk durur; beyaz boş sayfa yok.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/hasar-dosyalari/hasar-dosya-yukleme.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, '[id]/page.tsx'), 'utf8');
const skeleton = readFileSync(
  join(here, '../../../components/ui/skeletons/HasarDosyaKabukSkeleton.tsx'),
  'utf8',
);

describe('hasar dosya yükleme kabuğu LOCK', () => {
  it('yüklemede kabuk iskeleti durur; tam sayfa Yükleniyor yok', () => {
    assert.match(page, /HasarDosyaKabukSkeleton/);
    assert.doesNotMatch(page, /if \(loading\) return <div className="text-slate-400 py-16 text-center">Yükleniyor/);
    assert.match(skeleton, /hasar-dosya-yukleme-kabugu/);
    assert.match(skeleton, /SkeletonCard/);
    assert.match(skeleton, /SkeletonForm/);
  });

  it('bağlantı hatasında Tekrar Dene durur; 404 ayrı kalır', () => {
    assert.match(page, /Bağlantı hatası oluştu, lütfen tekrar deneyin/);
    assert.match(page, /Tekrar Dene/);
    assert.match(page, /Dosya bulunamadı/);
  });
});
