import { matchCityDistrictFromAddressText } from './inbound-location.util';

describe('matchCityDistrictFromAddressText', () => {
  const provinces = [
    { id: '48', name: 'Muğla' },
    { id: '34', name: 'İstanbul' },
  ];
  const byProvince = new Map([
    ['48', [{ name: 'Bodrum' }, { name: 'Marmaris' }, { name: 'Milas' }]],
    ['34', [{ name: 'Kadıköy' }, { name: 'Beşiktaş' }]],
  ]);
  const allDistricts = [
    { name: 'Bodrum', province: { name: 'Muğla' } },
    { name: 'Marmaris', province: { name: 'Muğla' } },
    { name: 'Kadıköy', province: { name: 'İstanbul' } },
  ];

  it('ilçe adından il çıkarır (Bodrum → Muğla)', () => {
    const result = matchCityDistrictFromAddressText(
      'Akyarlar Mh. 4265 Sk. No: 8B Da: 2 Bodrum Tel: 05322860150',
      provinces,
      byProvince,
      allDistricts,
    );
    expect(result).toEqual({ city: 'Muğla', district: 'Bodrum' });
  });

  it('il + ilçe birlikte geçince ikisini de bulur', () => {
    const result = matchCityDistrictFromAddressText(
      'Bodrum / Muğla',
      provinces,
      byProvince,
      allDistricts,
    );
    expect(result).toEqual({ city: 'Muğla', district: 'Bodrum' });
  });

  it('eşleşme yoksa null döner', () => {
    const result = matchCityDistrictFromAddressText(
      'Adres belirtilmedi',
      provinces,
      byProvince,
      allDistricts,
    );
    expect(result).toEqual({ city: null, district: null });
  });

  it('Afyon kısa adını Afyonkarahisar olarak çözer', () => {
    const afyonProvinces = [{ id: '03', name: 'Afyonkarahisar' }, ...provinces];
    const result = matchCityDistrictFromAddressText(
      'Sandıklı / Afyon',
      afyonProvinces,
      new Map([['03', [{ name: 'Sandıklı' }, { name: 'Dinar' }]]]),
      [{ name: 'Sandıklı', province: { name: 'Afyonkarahisar' } }],
    );
    expect(result).toEqual({ city: 'Afyonkarahisar', district: 'Sandıklı' });
  });

  it('ASCII Usak adresinden Uşak / Merkez çıkarır', () => {
    const usakProvinces = [{ id: '64', name: 'Uşak' }, ...provinces];
    const result = matchCityDistrictFromAddressText(
      'Fatih 2.Ulucan No : 10 Daire : 1 Merkez - Türkiye - Usak',
      usakProvinces,
      new Map([['64', [{ name: 'Banaz' }, { name: 'Merkez' }, { name: 'Eşme' }]]]),
      [{ name: 'Merkez', province: { name: 'Uşak' } }],
    );
    expect(result).toEqual({ city: 'Uşak', district: 'Merkez' });
  });
});
