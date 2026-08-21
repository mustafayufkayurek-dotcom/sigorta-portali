import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractInboundFormFields,
  getInboundFormFieldValue,
  INBOUND_ADDRESS_FIELD_LABELS,
  stripInboundAddressPollution,
} from './inbound-form-fields.ts';

describe('inbound address pollution LOCK', () => {
  it('Hasar Türü sızıntısını adres değerinden keser', () => {
    const raw =
      'Fatih 2.Ulucan No : 10 Daire : 1 Merkez - Türkiye - Usak Hasar Türü : Tesisat';
    assert.equal(
      stripInboundAddressPollution(raw),
      'Fatih 2.Ulucan No : 10 Daire : 1 Merkez - Türkiye - Usak',
    );
  });

  it('adres satırından telefonu keser', () => {
    assert.equal(
      stripInboundAddressPollution('Yokuşbaşı Mh. No:25b Tel : 05493384168 - İl (Muğla)'),
      'Yokuşbaşı Mh. No:25b - İl (Muğla)',
    );
  });

  it('Hasar Resmi sızıntısını adres değerinden keser', () => {
    assert.equal(
      stripInboundAddressPollution('Atatürk Cad. No: 5 Hasar Resmi : foto.jpg'),
      'Atatürk Cad. No: 5',
    );
  });

  it('Hasar Türü etiketinde durur ve adresi ayırır', () => {
    const text = `
Adres: Fatih 2.Ulucan No : 10 Daire : 1 Merkez - Türkiye - Usak
Hasar Türü : Tesisat
`.trim();
    const fields = extractInboundFormFields(text);
    assert.equal(
      getInboundFormFieldValue(fields, ...INBOUND_ADDRESS_FIELD_LABELS),
      'Fatih 2.Ulucan No : 10 Daire : 1 Merkez - Türkiye - Usak',
    );
    assert.equal(getInboundFormFieldValue(fields, 'Hasar Türü'), 'Tesisat');
  });
});
