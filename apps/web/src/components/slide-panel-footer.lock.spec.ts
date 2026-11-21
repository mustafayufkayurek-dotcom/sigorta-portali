/**
 * Sağ çekmece alt tuşları — ekran altına sarkmaz; görünür alanda kalır.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const webRoot = join(import.meta.dirname, '../..');

describe('SlidePanel alt tuş LOCK', () => {
  it('çekmece yüksekliği görünür ekranı aşmaz (svh)', () => {
    const panel = readFileSync(join(webRoot, 'src/components/SlidePanel.tsx'), 'utf8');
    assert.match(panel, /h-\[100svh\]/);
    assert.match(panel, /max-h-\[100svh\]/);
    assert.doesNotMatch(panel, /h-\[100dvh\]/);
    assert.match(panel, /data-testid="slide-panel-shell"/);
  });

  it('masraf formu alt Kaydet şeridi sabit ve güvenli alt boşluklu', () => {
    const masraf = readFileSync(
      join(webRoot, 'src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(masraf, /masraf-form-footer/);
    assert.match(masraf, /sticky bottom-0/);
    assert.match(masraf, /safe-area-inset-bottom/);
    assert.match(masraf, /scrollContent=\{false\}/);
    assert.match(masraf, /overscroll-contain/);
    assert.ok(
      masraf.indexOf('masraf-form-kabuk') < masraf.indexOf('masraf-form-footer'),
      'Alt tuşlar form kabuğunun içinde sabit satırda durur',
    );
  });
});
