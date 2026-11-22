/**
 * Masraf grup/alt grup penceresi SlidePanel flu örtüsünün altında kalmaz.
 * KDV oranı native select ile seçilir.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '../../../../../../..');

describe('Masraf modal katman LOCK', () => {
  const masraf = readFileSync(
    join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'),
    'utf8',
  );
  const finansModal = readFileSync(
    join(root, 'apps/web/src/components/finance/FinansPanelUI.tsx'),
    'utf8',
  );
  const slide = readFileSync(
    join(root, 'apps/web/src/components/SlidePanel.tsx'),
    'utf8',
  );

  it('grup/alt grup FinansModal portal ile açılır; SettingsModal z-50 yok', () => {
    assert.match(masraf, /FinansModal/);
    assert.match(masraf, /masraf-kategori-draft-modal/);
    assert.match(masraf, /masraf-kategori-draft-kdv/);
    assert.doesNotMatch(masraf, /SettingsModal/);
    assert.match(finansModal, /createPortal/);
    assert.match(finansModal, /z-\[400\]/);
  });

  it('SlidePanel flu örtü daha düşük katmandadır', () => {
    assert.match(slide, /z-\[200\]/);
    assert.match(slide, /backdrop-blur-\[2px\]/);
    assert.match(slide, /z-\[210\]/);
  });

  it('KDV oranı açılır liste (select) ile seçilir', () => {
    assert.match(masraf, /<select[\s\S]{0,500}masraf-kdv-oran/);
    assert.match(masraf, /masrafKdvOranlari\.map/);
    assert.doesNotMatch(masraf, /MasrafKdvOranInput/);
  });
});
