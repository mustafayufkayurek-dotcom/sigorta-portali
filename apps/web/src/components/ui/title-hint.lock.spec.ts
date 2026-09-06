/**
 * Başlık açıklaması bilgi ikonunda durur.
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

describe('başlık bilgi ikonu LOCK', () => {
  it('bilgi ikonu durur; üzerine gelince metin okunur', () => {
    assert.match(hint, /export function HintIcon/);
    assert.match(hint, /group-hover:block/);
    assert.match(hint, /text-brand-600/);
    assert.match(hint, /strokeWidth=\{2\.75\}/);
    assert.doesNotMatch(hint, /bg-slate-700/);
  });

  it('Yönetim Paneli açıklaması başlık altında cümle değildir', () => {
    assert.match(mgmtHeader, /HintIcon/);
    assert.doesNotMatch(mgmtHeader, /Kurumsal finans, operasyon ve personel/);
    assert.doesNotMatch(mgmtHeader, /tek ekranda izleyin/);
  });

  it('sayfa ve kart başlıkları açıklamayı ikona alır', () => {
    assert.match(pageHeader, /PageTitleWithHint/);
    assert.match(dashHeader, /HintIcon text=\{subtitle\}/);
    assert.doesNotMatch(dashHeader, /line-clamp-1/);
    assert.match(widget, /HintIcon text=\{subtitle\}/);
  });
});
