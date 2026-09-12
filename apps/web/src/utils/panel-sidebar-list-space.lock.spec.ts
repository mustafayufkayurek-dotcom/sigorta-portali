/**
 * Kilit: Sol menü dar rayda durur; açıkken listeyi ezmez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/panel-sidebar-list-space.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('panel sol menü liste boşluğu LOCK', () => {
  it('varsayılan dar menü; üzerine gelince yazı açılır, liste ezilmez', () => {
    const layout = readFileSync(join(here, '../app/panel/layout.tsx'), 'utf8');
    assert.match(layout, /\[sidebarCollapsed, setSidebarCollapsed\] = useState\(true\)/);
    assert.match(layout, /data-testid="panel-sidebar-rail"/);
    assert.match(layout, /style=\{\{ width: 72, minWidth: 72, maxWidth: 72 \}\}/);
    assert.match(layout, /fixed left-0 z-40/);
    assert.match(layout, /onMouseEnter=\{openHover\}/);
    assert.match(layout, /onMouseLeave=\{closeHoverSoon\}/);
    assert.match(layout, /const iconRail = collapsed && !hoverOpen/);
    assert.match(layout, /panel-sidebar-nav-icon/);
    assert.match(layout, /hasChildren && isExpanded && !iconRail/);
    assert.doesNotMatch(layout, /aria-label="Menüyü kapat"/);
    assert.doesNotMatch(layout, /bg-slate-900\/15/);
    assert.doesNotMatch(layout, /getItem\('panel-sidebar-collapsed'\) === 'true'/);
  });
});
