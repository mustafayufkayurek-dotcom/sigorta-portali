import {
  buildVendorNearbyWhere,
  buildVendorServiceAreaWhere,
  isUnresolvedLocationLabel,
  normalizeLocationLabel,
} from './vendor-area-match.util';

describe('vendor-area-match.util', () => {
  describe('isUnresolvedLocationLabel', () => {
    it('Belirtilmemiş ve boş değerleri unresolved sayar', () => {
      expect(isUnresolvedLocationLabel('Belirtilmemiş')).toBe(true);
      expect(isUnresolvedLocationLabel('')).toBe(true);
      expect(isUnresolvedLocationLabel(null)).toBe(true);
      expect(isUnresolvedLocationLabel('Muğla')).toBe(false);
    });
  });

  describe('normalizeLocationLabel', () => {
    it('placeholder’ı null’a çevirir', () => {
      expect(normalizeLocationLabel('Belirtilmemiş')).toBeNull();
      expect(normalizeLocationLabel('  Bodrum  ')).toBe('Bodrum');
    });
  });

  describe('buildVendorServiceAreaWhere', () => {
    it('ilçe yokken ildeki tüm hizmet bölgelerini eşler', () => {
      expect(buildVendorServiceAreaWhere('prov-1', null)).toEqual({ provinceId: 'prov-1' });
    });

    it('ilçe varken ilçe veya il geneli eşler', () => {
      expect(buildVendorServiceAreaWhere('prov-1', 'dist-1')).toEqual({
        provinceId: 'prov-1',
        OR: [{ districtId: 'dist-1' }, { districtId: null }],
      });
    });
  });

  describe('buildVendorNearbyWhere', () => {
    it('bölge yokken tüm aktif tedarikçileri döner (Belirtilmemiş filtrelemez)', () => {
      expect(
        buildVendorNearbyWhere({
          provinceId: null,
          districtId: null,
          city: 'Belirtilmemiş',
          districtName: 'Belirtilmemiş',
          purpose: 'supplier',
        }),
      ).toEqual({ status: 'active' });
    });

    it('il bilindiğinde birden fazla eşleşme yolunu açar', () => {
      const where = buildVendorNearbyWhere({
        provinceId: 'prov-mugla',
        districtId: 'dist-milas',
        city: 'Muğla',
        districtName: 'Milas',
        purpose: 'supplier',
      });
      expect(where.status).toBe('active');
      expect(where.OR).toEqual(
        expect.arrayContaining([
          {
            serviceAreas: {
              some: {
                provinceId: 'prov-mugla',
                OR: [{ districtId: 'dist-milas' }, { districtId: null }],
              },
            },
          },
          {
            AND: [
              { city: { equals: 'Muğla', mode: 'insensitive' } },
              { district: { equals: 'Milas', mode: 'insensitive' } },
            ],
          },
        ]),
      );
    });
  });
});
