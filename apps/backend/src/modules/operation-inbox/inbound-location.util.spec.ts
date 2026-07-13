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
});
