/**
 * Kilit: Sol menü tıklayınca yer açar; verinin üstüne binmez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/panel-sidebar-list-space.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('panel sol menü liste boşluğu LOCK', () => {
  it('varsayılan dar menü; tıklayınca yer açar, verinin üstüne binmez', () => {
    const layout = readFileSync(join(here, '../app/panel/layout.tsx'), 'utf8');
    assert.match(layout, /\[sidebarCollapsed, setSidebarCollapsed\] = useState\(true\)/);
    assert.match(layout, /data-testid="panel-sidebar-rail"/);
    assert.match(layout, /onToggleSidebar/);
    assert.match(layout, /data-testid="panel-sidebar-toggle"/);
    assert.match(layout, /Menüyü Genişlet/);
    assert.match(layout, /Menüyü Daralt/);
    assert.doesNotMatch(layout, /Anket Sonuçları', href: '\/panel\/anketler\/sonuclar'/);
    assert.match(layout, /panel-sidebar-nav-icon/);
    assert.match(layout, /hasChildren && isExpanded && !collapsed/);
    assert.match(layout, /relative h-full min-h-0 hidden flex-col/);
    assert.doesNotMatch(layout, /onMouseEnter=\{openHover\}/);
    assert.doesNotMatch(layout, /fixed left-0 z-40/);
    assert.doesNotMatch(layout, /aria-label="Menüyü kapat"/);
    assert.doesNotMatch(layout, /bg-slate-900\/15/);
    assert.match(layout, /AttendancePanelGate/);
  });
});
