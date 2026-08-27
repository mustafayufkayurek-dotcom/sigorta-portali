/**
 * Kilit: Sigorta portalı dosya evrakında muvafakat görüntülenir ve yazdırılır.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/sigorta-portal/sigorta-evrak-muvafakat.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const components = join(here, '../../../components/eksper-portal');

describe('sigorta evrak muvafakat LOCK', () => {
  it('çekmece Evraklar + görüntüle yazdır', () => {
    const drawer = readFileSync(
      join(components, 'ExpertFileDetailDrawer.tsx'),
      'utf8',
    );
    assert.match(drawer, /isInsurance/);
    assert.match(drawer, /label: 'Evraklar'/);
    assert.match(drawer, /openFileDocumentView/);
    assert.match(drawer, /print: true/);
    assert.match(drawer, /claimManualDocumentLabel/);
  });

  it('evrak kutusu muvafakati Matbu diye gizlemez', () => {
    const modal = readFileSync(
      join(components, 'ExpertFileModals.tsx'),
      'utf8',
    );
    assert.match(modal, /claimManualDocumentLabel/);
    assert.match(modal, /openFileDocumentView/);
    assert.match(modal, /title="Yazdır"/);
    assert.doesNotMatch(
      modal,
      /row\.documentKind === 'muvafakatname' \? 'Muvafakatname' : 'Matbu Evrak'/,
    );
  });
});
