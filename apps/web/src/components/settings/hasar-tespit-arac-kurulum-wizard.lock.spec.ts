/**
 * Hasar Tespit araç kurulumu — giriş penceresi + sağ şerit çekmece + çıkış kilidi.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../../../../');

describe('Hasar Tespit araç kurulum wizard LOCK', () => {
  it('girişte yönlendirmeli liste; dışarı tıklayınca sağ Panel şeridi; çıkış kilitli', () => {
    const wizard = readFileSync(join(here, 'HasarTespitAracKurulumWizard.tsx'), 'utf8');
    const layout = readFileSync(join(root, 'apps/web/src/app/panel/layout.tsx'), 'utf8');
    const tanimlar = readFileSync(join(root, 'apps/web/src/app/panel/ayarlar/tanimlar/page.tsx'), 'utf8');
    const aracPage = readFileSync(
      join(root, 'apps/web/src/app/panel/ayarlar/hasar-tespit-arac/page.tsx'),
      'utf8',
    );
    const shared = readFileSync(join(root, 'packages/shared/src/hasar-tespit-bedel.ts'), 'utf8');
    const ctrl = readFileSync(
      join(root, 'apps/backend/src/modules/hasar-tespit-bedel/hasar-tespit-bedel.controller.ts'),
      'utf8',
    );
    const guard = readFileSync(
      join(root, 'apps/web/src/contexts/NavigationGuardContext.tsx'),
      'utf8',
    );
    const reminder = readFileSync(
      join(root, 'apps/web/src/components/damage-reports/SaveReminderModal.tsx'),
      'utf8',
    );
    const finansUi = readFileSync(
      join(root, 'apps/web/src/components/finance/FinansPanelUI.tsx'),
      'utf8',
    );

    assert.match(wizard, /hasar-tespit-arac-kurulum-wizard/);
    assert.match(wizard, /Sayfaya Git/);
    assert.match(wizard, /hasar-tespit-arac-kurulum-cekmece/);
    assert.match(wizard, /RightPanelDockTab/);
    assert.match(wizard, /tone="amber"/);
    assert.match(wizard, /label="Kurulum"/);
    assert.match(wizard, /remindEnabled=\{false\}/);
    assert.doesNotMatch(wizard, /Kurulum \$\{stepNo\}/);
    assert.doesNotMatch(wizard, /Şimdilik Üste Çek/);
    assert.doesNotMatch(wizard, /paddingTop = '3\.5rem'/);
    assert.doesNotMatch(wizard, /border-b border-amber-300 bg-amber-50/);
    // Adımlar bitince şerit kalıcı kalkar; yeni eksikte API show ile yeniden açılır
    assert.match(wizard, /nextSteps\.length === 0/);
    assert.match(wizard, /mode: 'hidden'/);
    assert.match(wizard, /sessionStorage\.removeItem\(UI_KEY\)/);
    assert.match(wizard, /hasarTespitAracKurulumHref/);
    assert.match(wizard, /onBackdropClose/);
    assert.match(wizard, /getToken/);
    assert.doesNotMatch(wizard, /getAccessToken/);
    assert.match(wizard, /HASAR_TESPIT_ARAC_KAYDEDILDI|hasar-tespit-arac-kaydedildi/);
    assert.match(wizard, /forceModal/);
    assert.match(wizard, /data\.show|serverShow/);
    assert.match(wizard, /forbidExit/);
    assert.match(wizard, /logoutOnly/);
    assert.match(wizard, /beforeunload/);
    assert.match(wizard, /Kurulum işlemlerini tamamlayın/);
    assert.match(layout, /HasarTespitAracKurulumWizard/);
    assert.doesNotMatch(tanimlar, /tanimlar-arac-kurulum-checklist/);
    assert.match(aracPage, /arac-kurulum-sorumlular/);
    assert.match(aracPage, /id="arac-kurulum-kira"/);
    assert.match(aracPage, /id="arac-kurulum-cikis"/);
    assert.match(aracPage, /hasar-tespit-arac-kaydedildi/);
    assert.match(shared, /HASAR_TESPIT_ARAC_KURULUM_HREF/);
    assert.match(ctrl, /arac-kurulum/);
    assert.match(guard, /forbidExit/);
    assert.match(guard, /logoutOnly/);
    assert.match(reminder, /kurulum-cikis-engeli/);
    assert.match(reminder, /Kurulum İşlemlerini Tamamlayın/);
    assert.match(finansUi, /onBackdropClose/);
  });
});
