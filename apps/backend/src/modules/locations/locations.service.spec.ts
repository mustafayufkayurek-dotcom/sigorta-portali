import { LocationsService } from './locations.service';

describe('LocationsService.districtNameAliases', () => {
  const service = new LocationsService({} as any);

  it('Muş Merkez için Merkez ve il adını üretir', () => {
    const aliases = service.districtNameAliases('Muş', 'Muş Merkez');
    expect(aliases).toEqual(expect.arrayContaining(['Muş Merkez', 'Merkez', 'Muş']));
  });

  it('yalnız Merkez için İl Merkez üretir', () => {
    const aliases = service.districtNameAliases('Bilecik', 'Merkez');
    expect(aliases).toEqual(expect.arrayContaining(['Merkez', 'Bilecik Merkez', 'Bilecik']));
  });
});

describe('LocationsService mahalle kalite filtresi', () => {
  const service = new LocationsService({} as any);

  it('yalnız Merkez kayıtlarını düşük kalite sayar', () => {
    expect(
      service.isLowQualityNeighborhoodList(['Merkez', 'Merkez Mahallesi'], 'Uşak', 'Merkez'),
    ).toBe(true);
  });

  it('gerçek mahalle listesini kabul eder', () => {
    const names = [
      'Kemalöz Mahallesi',
      'Atatürk Mahallesi',
      'Fatih Mahallesi',
      'Cumhuriyet Mahallesi',
      'Işık Mahallesi',
      'Kurtuluş Mahallesi',
    ];
    expect(service.isLowQualityNeighborhoodList(names, 'Uşak', 'Merkez')).toBe(false);
  });

  it('junk isimleri ayıklar', () => {
    expect(service.isJunkNeighborhoodName('Merkez', 'Uşak', 'Merkez')).toBe(true);
    expect(service.isJunkNeighborhoodName('Kemalöz Mahallesi', 'Uşak', 'Merkez')).toBe(false);
  });
});
