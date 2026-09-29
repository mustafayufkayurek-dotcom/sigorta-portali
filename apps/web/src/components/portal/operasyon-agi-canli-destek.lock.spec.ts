/**
 * Operasyon Ağı ve müşteri portal kapısı.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/web/src/components/portal/operasyon-agi-canli-destek.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('operasyon ağı canlı destek LOCK', () => {
  it('mavi bant ile Canlı Destek ayrı durur; yazı kesilmez', () => {
    const band = readFileSync(join(here, 'OperationReferencePrivacySection.tsx'), 'utf8');
    const support = readFileSync(
      join(here, '../panel/portal-whatsapp-live-support.tsx'),
      'utf8',
    );
    assert.match(band, /operasyon-agi-footer-band/);
    assert.match(band, /mb-24/);
    assert.match(band, /leading-snug/);
    assert.doesNotMatch(band, /md:pr-44/);
    assert.doesNotMatch(band, /max-w-3xl/);
    assert.match(band, /Meridyen Hakkında Daha Fazla/);
    assert.match(support, /portal-whatsapp-live-support/);
    assert.match(support, /Canlı Destek/);
  });

  it('bant tuşu sigorta ana sayfasına gider; ofis paneline düşmez', () => {
    const band = readFileSync(join(here, 'OperationReferencePrivacySection.tsx'), 'utf8');
    const layout = readFileSync(join(here, '../../app/panel/layout.tsx'), 'utf8');
    assert.match(band, /href="\/panel\/sigorta-portal"/);
    assert.doesNotMatch(band, /href="\/panel"/);
    assert.match(layout, /pathname !== '\/panel'/);
    assert.match(layout, /isInsuranceCompanyUser\) router\.replace\('\/panel\/sigorta-portal'\)/);
  });

  it('müşteri breadcrumb ofis Dashboard’a gitmez', () => {
    const crumb = readFileSync(join(here, 'PortalBreadcrumb.tsx'), 'utf8');
    assert.doesNotMatch(crumb, /href="\/panel"/);
    assert.doesNotMatch(crumb, /Dashboard/);
    assert.match(crumb, /portalHomeHref/);
  });
});
