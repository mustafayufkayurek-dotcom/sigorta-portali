/**
 * Kilit: Sağ panel soldaki sayfaya tıklanınca kapanmaz; sağa kayar, işlem durur.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/ui/right-panel-dock.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { RIGHT_PANEL_DOCK_REMIND_MS, rightPanelDockClass } from './right-panel-dock.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('sağ panel kaydır LOCK', () => {
  it('açıkken kaydırınca şerit kalır; kapalıyken tam gizlenir', () => {
    assert.equal(rightPanelDockClass(false, false), 'translate-x-full pointer-events-none');
    assert.equal(rightPanelDockClass(true, false), 'translate-x-0');
    assert.match(rightPanelDockClass(true, true), /translate-x-full/);
    assert.match(rightPanelDockClass(true, true), /overflow-hidden/);
    assert.doesNotMatch(rightPanelDockClass(true, true), /2\.75rem/);
  });

  it('ortak kabuk soldaki sayfaya tıklayınca kapatmaz', () => {
    const slide = readFileSync(join(here, '../SlidePanel.tsx'), 'utf8');
    assert.match(slide, /useRightPanelDock/);
    assert.match(slide, /onClick=\{dock\}/);
    assert.match(slide, /RightPanelDockTab/);
    assert.match(slide, /OPS_NOTICE\.sagPanelKaydir/);
    const tab = readFileSync(join(here, 'right-panel-dock.tsx'), 'utf8');
    assert.match(tab, /sag-panel-geri-ac/);
    assert.match(tab, /createPortal/);
    assert.match(tab, /fixed right-0/);
    assert.doesNotMatch(tab, /absolute left-0/);
    assert.match(tab, /sag-panel-hatirlat/);
    assert.match(tab, /acil-siradaki-pulse/);
    assert.match(tab, /Bekleyen işlem/);
    assert.match(tab, /Geri aç/);
    assert.equal(RIGHT_PANEL_DOCK_REMIND_MS, 20_000);
  });

  it('Acil ve Hasar çekmecesi aynı kaydırmayı kullanır; hakediş dışarı tıklayınca formu silmez', () => {
    const acil = readFileSync(
      join(here, '../acil-operasyon-planlayicisi/AcilOperasyonPlanlayiciPanel.tsx'),
      'utf8',
    );
    const hasar = readFileSync(
      join(here, '../hasar-operasyon-planlayicisi/OperasyonPlanlayiciPanel.tsx'),
      'utf8',
    );
    const hakedis = readFileSync(join(here, '../finance/HasarFileHakedisPanel.tsx'), 'utf8');
    assert.match(acil, /useRightPanelDock/);
    assert.match(acil, /onClick=\{dock\}/);
    assert.match(acil, /RightPanelDockTab/);
    assert.match(hasar, /useRightPanelDock/);
    assert.match(hasar, /onClick=\{dock\}/);
    assert.match(hakedis, /useRightPanelDock/);
    assert.match(hakedis, /onClick=\{dock\}/);
    assert.match(hakedis, /aria-label="Paneli yana kaydır"/);
  });

  it('kaydedilmemiş işlemde X ve çıkış kayıt hatırlatmasına gider', () => {
    const unsaved = readFileSync(join(here, 'right-panel-unsaved.ts'), 'utf8');
    assert.match(unsaved, /RIGHT_PANEL_UNSAVED_MESSAGE/);
    assert.match(unsaved, /registerGuard/);
    assert.match(unsaved, /tryNavigate/);
    assert.match(unsaved, /onContinue/);
    const slide = readFileSync(join(here, '../SlidePanel.tsx'), 'utf8');
    const acil = readFileSync(
      join(here, '../acil-operasyon-planlayicisi/AcilOperasyonPlanlayiciPanel.tsx'),
      'utf8',
    );
    const hasar = readFileSync(
      join(here, '../hasar-operasyon-planlayicisi/OperasyonPlanlayiciPanel.tsx'),
      'utf8',
    );
    const hakedis = readFileSync(join(here, '../finance/HasarFileHakedisPanel.tsx'), 'utf8');
    const reminder = readFileSync(join(here, '../damage-reports/SaveReminderModal.tsx'), 'utf8');
    const guard = readFileSync(join(here, '../../contexts/NavigationGuardContext.tsx'), 'utf8');
    assert.match(slide, /useRightPanelUnsavedGuard/);
    assert.match(slide, /requestClose/);
    assert.match(acil, /useRightPanelUnsavedGuard/);
    assert.match(acil, /requestClose/);
    assert.match(hasar, /useRightPanelUnsavedGuard/);
    assert.match(hasar, /requestClose/);
    assert.match(hakedis, /useRightPanelUnsavedGuard/);
    assert.match(hakedis, /requestClose/);
    assert.match(reminder, /kayit-hatirlatmasi/);
    assert.match(reminder, /z-\[240\]/);
    assert.match(guard, /message\?: string/);
    assert.match(guard, /onContinue\?: \(\) => void/);
  });
});
