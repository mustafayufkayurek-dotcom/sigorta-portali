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
    assert.match(layout, /aria-label="Menü"/);
    assert.doesNotMatch(layout, /Menüyü Genişlet/);
    assert.doesNotMatch(layout, /Menüyü Daralt/);
    assert.doesNotMatch(layout, /Anket Sonuçları', href: '\/panel\/anketler\/sonuclar'/);
    assert.match(layout, /panel-sidebar-nav-icon/);
    assert.match(layout, /hasChildren && isExpanded && !collapsed/);
    assert.match(layout, /relative h-full min-h-0 hidden flex-col/);
    assert.doesNotMatch(layout, /onMouseEnter=\{openHover\}/);
    assert.doesNotMatch(layout, /fixed left-0 z-40/);
    assert.doesNotMatch(layout, /aria-label="Menüyü kapat"/);
    assert.doesNotMatch(layout, /bg-slate-900\/15/);
    assert.match(layout, /AttendancePanelGate/);
    assert.match(layout, /mx-auto min-w-0 w-full px-3 sm:px-4/);
    assert.doesNotMatch(layout, /max-w-screen-2xl px-3 sm:px-4/);
    const shell = readFileSync(join(here, '../app/panel/_components/dashboard-shell.tsx'), 'utf8');
    assert.doesNotMatch(shell, /max-w-\[1600px\]/);
    const mgmt = readFileSync(
      join(here, '../features/dashboard/components/management-dashboard/ManagementDashboard.tsx'),
      'utf8',
    );
    assert.doesNotMatch(mgmt, /max-w-\[1600px\]/);
  });
});
