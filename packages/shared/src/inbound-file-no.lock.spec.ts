/**
 * Çalıştır:
 *   node --experimental-strip-types --test packages/shared/src/inbound-file-no.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isInsuranceBrandFileNo,
  resolveInboundFileNo,
} from './inbound-file-no.ts';

describe('inbound file no × sigorta markası LOCK', () => {
  it('gövdedeki EUREKO dosya no sayılmaz; konu satırındaki numara alınır', () => {
    const resolved = resolveInboundFileNo({
      bodyFileNo: 'EUREKO',
      insurer: 'EUREKO',
      subject: 'EUREKO 26645495 ILKNUR YILMAZ',
      policyNo: '89046645',
    });
    assert.equal(resolved.fileNo, '26645495');
    assert.equal(resolved.bodyRejected, true);
    assert.match(resolved.warning ?? '', /26645495/);
    assert.equal(isInsuranceBrandFileNo('EUREKO', 'Eureko Sigorta'), true);
    assert.equal(isInsuranceBrandFileNo('26645495', 'Eureko Sigorta'), false);
  });

  it('poliçe numarasını dosya no sanmaz', () => {
    const resolved = resolveInboundFileNo({
      bodyFileNo: 'EUREKO',
      insurer: 'Eureko Sigorta',
      subject: 'Ynt: EUREKO 26645495 ILKNUR YILMAZ',
      policyNo: '89046645',
      extraText: 'Eureko Sigorta 26645495 İlknur',
    });
    assert.equal(resolved.fileNo, '26645495');
  });

  it('poliçe numarası dosya no olarak yazılmışsa konu satırındaki gerçek numarayı alır', () => {
    const resolved = resolveInboundFileNo({
      bodyFileNo: '89046645',
      insurer: 'Eureko Sigorta',
      subject: 'EUREKO 26645495 ILKNUR YILMAZ',
      policyNo: '89046645',
    });
    assert.equal(resolved.fileNo, '26645495');
    assert.equal(resolved.bodyRejected, true);
    assert.match(resolved.warning ?? '', /poliçe/i);
  });

  it('Dosya No satırına yapışan poliçe numarasını da reddeder', () => {
    const resolved = resolveInboundFileNo({
      bodyFileNo: '89046645\nSigortalı: İLKNUR YILMAZ',
      insurer: 'Eureko Sigorta',
      subject: 'EUREKO 26645495 ILKNUR YILMAZ',
      policyNo: '89046645',
    });
    assert.equal(resolved.fileNo, '26645495');
  });

  it('geçerli dosya no durur', () => {
    const resolved = resolveInboundFileNo({
      bodyFileNo: 'RCS-20261805465',
      insurer: 'Anadolu Sigorta',
      subject: 'Ynt: 744875622/ÖZGE ORAL/RCS-20261805465/TESİSAT',
      policyNo: '744875622',
    });
    assert.equal(resolved.fileNo, 'RCS-20261805465');
    assert.equal(resolved.warning, null);
  });

  it('Remed konu satırındaki RCS dosya no, poliçe numarasının yerini alır', () => {
    const resolved = resolveInboundFileNo({
      bodyFileNo: '1619479924',
      insurer: 'Anadolu Sigorta',
      subject: 'Ynt: 1619479924/KARAKOL KARDEŞLER OTOMOTİV/RCS-20261854032/CAM',
      policyNo: '1619479924',
    });
    assert.equal(resolved.fileNo, 'RCS-20261854032');
    assert.equal(resolved.bodyRejected, true);
    assert.match(resolved.warning ?? '', /RCS-20261854032/);
  });

  it('poliçe alanı boş olsa da RCS varken çıplak sayıyı dosya no yazmaz', () => {
    const resolved = resolveInboundFileNo({
      bodyFileNo: '362086678',
      subject: '362086678/ALI ANIL GURKAS/RCS-20261859999/KONUT',
    });
    assert.equal(resolved.fileNo, 'RCS-20261859999');
    assert.equal(resolved.bodyRejected, true);
  });
});
