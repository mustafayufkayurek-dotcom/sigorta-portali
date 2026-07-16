import {
  buildExpertiseHints,
  resolveOperationGroupLabel,
  resolveTerminologySync,
  serviceTypeMatchesKeys,
} from './terminology-memory.helper';

describe('terminology-memory — Operasyon Grubu (üst grup)', () => {
  it('Cam Kırığı → Cam Kırılması → Cam Hizmetleri', () => {
    const r = resolveTerminologySync('Cam Kırığı');
    expect(r.matched).toBe(true);
    expect(r.originalText).toBe('Cam Kırığı');
    expect(r.canonicalLabel).toBe('Cam Kırılması');
    expect(r.operationGroup).toBe('Cam Hizmetleri');
  });

  it('Cam Kırılması → Cam Hizmetleri (yalnızca synonym değil)', () => {
    const r = resolveTerminologySync('Cam Kırılması');
    expect(r.operationGroup).toBe('Cam Hizmetleri');
    expect(r.canonicalLabel).toBe('Cam Kırılması');
  });

  it('uzmanlık ipuçları Cam Ustası / Cam İşleri içerir', () => {
    const hints = buildExpertiseHints('Cam Hizmetleri', ['Cam Kırılması']);
    expect(hints).toEqual(expect.arrayContaining(['Cam Ustası', 'Cam İşleri', 'Cam Kırılması']));
  });

  it('aynı Operasyon Grubu altında maliyet eşleşmesi', () => {
    expect(
      serviceTypeMatchesKeys('Cam Kırılması', ['Cam Hizmetleri', 'Cam Kırığı'], 'Cam Hizmetleri'),
    ).toBe(true);
    expect(
      serviceTypeMatchesKeys('Cam Kırığı', ['Cam Hizmetleri'], 'Cam Hizmetleri'),
    ).toBe(true);
  });

  it('resolveOperationGroupLabel doğrudan üst grup üretir', () => {
    expect(resolveOperationGroupLabel('Cam Kırılması')).toBe('Cam Hizmetleri');
    expect(resolveOperationGroupLabel('Cam Hizmetleri')).toBe('Cam Hizmetleri');
  });
});
