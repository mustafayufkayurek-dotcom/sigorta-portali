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
