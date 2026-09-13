/**
 * Başlık yanında i yok. Dönem tuşları sağda, başlık tek satır.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/ui/title-hint.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const hint = readFileSync(join(here, 'HintIcon.tsx'), 'utf8');
const pageHeader = readFileSync(join(here, 'PageHeader.tsx'), 'utf8');
const mgmtHeader = readFileSync(
  join(here, '../../features/dashboard/components/management-dashboard/MgmtHeader.tsx'),
  'utf8',
);
const dashHeader = readFileSync(join(here, '../../app/panel/_components/dashboard-header.tsx'), 'utf8');
const widget = readFileSync(
  join(here, '../../features/dashboard/components/widget-frame/widget-frame.tsx'),
  'utf8',
);
const hasarList = readFileSync(join(here, '../../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
const acilList = readFileSync(join(here, '../../app/panel/operasyon/page.tsx'), 'utf8');
const tedarikciList = readFileSync(join(here, '../../app/panel/tedarikciler/page.tsx'), 'utf8');

describe('başlık bilgi ikonu LOCK', () => {
  it('i ikonu çizilmez', () => {
    assert.match(hint, /export function HintIcon/);
    assert.match(hint, /return null/);
    assert.doesNotMatch(hint, /group-hover:block/);
  });

  it('Yönetim Paneli tek satır; dönem sağda; i yok', () => {
    assert.doesNotMatch(mgmtHeader, /HintIcon/);
    assert.match(mgmtHeader, /whitespace-nowrap/);
    assert.match(mgmtHeader, /ml-auto flex min-w-0 flex-wrap items-center justify-end/);
    assert.doesNotMatch(mgmtHeader, /flex-col gap-3 lg:flex-row/);
  });

  it('liste başlığı başlığı tekrarlayan i metni taşımaz', () => {
    assert.doesNotMatch(hasarList, /Hasar dosyası listesi/);
    assert.doesNotMatch(hasarList, /Size atanan hasar işleri/);
    assert.doesNotMatch(acilList, /Acil yardım dosyası listesi/);
    assert.doesNotMatch(acilList, /Dosya durumu, sorumluluk ve gecikme süresi/);
    assert.doesNotMatch(tedarikciList, /Kayıtlı tedarikçi ve alt yüklenici listesi/);
  });

  it('sayfa başlığı i ile açıklama basmaz', () => {
    assert.match(pageHeader, /PageTitleWithHint/);
    assert.doesNotMatch(dashHeader, /HintIcon/);
    assert.doesNotMatch(dashHeader, /line-clamp-1/);
    assert.match(widget, /subtitle/);
  });
});
