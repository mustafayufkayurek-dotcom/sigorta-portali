import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatMeridyenDisplayLabel } from './display-label.ts';

describe('Meridyen görünen ad LOCK', () => {
  it('konut yangın kodu ve boşluksuz yazım Konut-Yangın olur', () => {
    assert.equal(formatMeridyenDisplayLabel('konut-yangin'), 'Konut-Yangın');
    assert.equal(formatMeridyenDisplayLabel('Konut Yangın'), 'Konut-Yangın');
    assert.equal(formatMeridyenDisplayLabel('Konut Yangını'), 'Konut-Yangın');
    assert.equal(formatMeridyenDisplayLabel('Konut-Yangın'), 'Konut-Yangın');
  });

  it('endüstriyel yangın Türkçe ve tireli durur', () => {
    assert.equal(formatMeridyenDisplayLabel('endustriyel-yangin'), 'Endüstriyel-Yangın');
    assert.equal(formatMeridyenDisplayLabel('Endüstriyel Yangın'), 'Endüstriyel-Yangın');
  });

  it('zaten düzgün tireli ad bozulmaz', () => {
    assert.equal(formatMeridyenDisplayLabel('Sel-Seylap'), 'Sel-Seylap');
    assert.equal(formatMeridyenDisplayLabel('Yangın'), 'Yangın');
    assert.equal(formatMeridyenDisplayLabel('Konut'), 'Konut');
    assert.equal(formatMeridyenDisplayLabel('HASAR_ONARIM'), 'Hasar Onarım');
  });
});
