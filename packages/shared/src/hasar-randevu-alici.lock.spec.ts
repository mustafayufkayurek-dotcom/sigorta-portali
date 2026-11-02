import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hasarRandevuAlici, hasarRandevuMailAlici } from './hasar-randevu-alici.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar randevu alıcı kilidi', () => {
  it('irtibat telefonu varsa randevu yetkiliye gitmez', () => {
    const alici = hasarRandevuAlici({
      siteContactName: 'Sena Eser',
      siteContactPhone: '905494398584',
      insuredName: 'Kelebek Fatih Mağazası',
      insuredPhone: '905497969802',
      customerPhone: '9055515139878',
    });
    assert.equal(alici.viaIrtibat, true);
    assert.equal(alici.name, 'Sena Eser');
    assert.equal(alici.phone, '905494398584');
  });

  it('irtibat yoksa sigortalı telefona düşer', () => {
    const alici = hasarRandevuAlici({
      insuredName: 'Ahmet Yılmaz',
      insuredPhone: '5321334144',
    });
    assert.equal(alici.viaIrtibat, false);
    assert.equal(alici.name, 'Ahmet Yılmaz');
    assert.equal(alici.phone, '5321334144');
  });

  it('tespit planı maili irtibat kutusuna gider; yetkiliye düşmez', () => {
    assert.deepEqual(
      hasarRandevuMailAlici({
        siteContactName: 'Sena Eser',
        siteContactEmail: 'sena@ornek.com',
      }),
      { email: 'sena@ornek.com', name: 'Sena Eser' },
    );
    assert.equal(
      hasarRandevuMailAlici({
        siteContactName: 'Sena Eser',
        siteContactPhone: '905494398584',
      }),
      null,
    );
    const ops = readFileSync(
      join(here, '../../../apps/backend/src/modules/claim-files/claim-operation-center.service.ts'),
      'utf8',
    );
    assert.match(ops, /hasarRandevuMailAlici/);
    assert.doesNotMatch(ops, /resolveApproval72hCustomerEmailPayload\(\{/);
    assert.doesNotMatch(ops, /Tespit planı müşteriye mail gitti/);
  });

  it('planlayıcı ve kayıt kapısı irtibatı kullanır', () => {
    const steps = readFileSync(
      join(here, '../../../apps/web/src/components/hasar-operasyon-planlayicisi/steps.tsx'),
      'utf8',
    );
    const planner = readFileSync(
      join(here, '../../../apps/web/src/components/hasar-operasyon-planlayicisi/planner-context.tsx'),
      'utf8',
    );
    const ops = readFileSync(
      join(here, '../../../apps/backend/src/modules/claim-files/claim-operation-center.service.ts'),
      'utf8',
    );
    assert.match(steps, /hasarRandevuAlici/);
    assert.match(planner, /hasarRandevuAlici/);
    assert.match(ops, /hasarRandevuAlici/);
    assert.doesNotMatch(steps.slice(steps.indexOf('function StepInsuredAppointment'), steps.indexOf('function StepInspector')), /phone=\{claim\.insuredPhone\}/);
  });
});
