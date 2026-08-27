import {
  buildSupplierFallbackWhere,
  buildVendorNearbyWhere,
  buildVendorServiceAreaWhere,
  isUnresolvedLocationLabel,
  normalizeLocationLabel,
  resolveProvinceDistrictIds,
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

    it('il id yokken Afyon hizmet bölgesi ve şehir adıyla eşler', () => {
      const where = buildVendorNearbyWhere({
        provinceId: null,
        districtId: null,
        city: 'Afyon',
        purpose: 'supplier',
      });
      expect(where.status).toBe('active');
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { city: { equals: 'Afyon', mode: 'insensitive' } },
          { city: { equals: 'Afyonkarahisar', mode: 'insensitive' } },
          {
            serviceAreas: {
              some: { province: { name: { equals: 'Afyonkarahisar', mode: 'insensitive' } } },
            },
          },
        ]),
      );
    });

    it('il id yokken ilçe adı (Kartepe) hizmet bölgesinden bulunur', () => {
      const where = buildVendorNearbyWhere({
        provinceId: null,
        districtId: null,
        city: 'Kartepe',
        purpose: 'supplier',
      });
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { district: { equals: 'Kartepe', mode: 'insensitive' } },
          {
            serviceAreas: {
              some: { district: { name: { equals: 'Kartepe', mode: 'insensitive' } } },
            },
          },
        ]),
      );
    });

    it('il bilindiğinde hizmet bölgesi ve il/ilçe metin eşleşmesini açar', () => {
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
          { city: { equals: 'Muğla', mode: 'insensitive' } },
          { district: { equals: 'Milas', mode: 'insensitive' } },
        ]),
      );
    });

    it('tedarikçi için il eşleşmesinde ilçe zorunlu değildir', () => {
      const where = buildVendorNearbyWhere({
        provinceId: 'prov-van',
        districtId: 'dist-baskale',
        city: 'Van',
        districtName: 'Başkale',
        purpose: 'supplier',
      });
      expect(where.status).toBe('active');
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { city: { equals: 'Van', mode: 'insensitive' } },
          { district: { equals: 'Başkale', mode: 'insensitive' } },
        ]),
      );
      expect(where.OR).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            AND: expect.any(Array),
          }),
        ]),
      );
    });

    it('tespitçi için il eşleşmesinde ilçe zorunlu değildir', () => {
      const where = buildVendorNearbyWhere({
        provinceId: 'prov-istanbul',
        districtId: 'dist-pendik',
        city: 'İstanbul',
        districtName: 'Pendik',
        purpose: 'inspector',
      });
      expect(where.canActAsInspector).toBe(true);
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { city: { equals: 'İstanbul', mode: 'insensitive' } },
          { district: { equals: 'Pendik', mode: 'insensitive' } },
        ]),
      );
    });
  });

  describe('buildSupplierFallbackWhere', () => {
    it('acil havuzu için yalnızca acil + her_ikisi döner', () => {
      expect(buildSupplierFallbackWhere(['acil', 'her_ikisi'])).toEqual({
        status: 'active',
        category: { in: ['acil', 'her_ikisi'] },
      });
    });

    it('hasar havuzu için yalnızca hasar + her_ikisi döner', () => {
      expect(buildSupplierFallbackWhere(['hasar', 'her_ikisi'])).toEqual({
        status: 'active',
        category: { in: ['hasar', 'her_ikisi'] },
      });
    });

    it('kategori yoksa yalnızca aktif durumu ister', () => {
      expect(buildSupplierFallbackWhere(null)).toEqual({ status: 'active' });
    });
  });

  describe('resolveProvinceDistrictIds', () => {
    const provinces = [
      { id: 'p-afyon', name: 'Afyonkarahisar' },
      { id: 'p-kocaeli', name: 'Kocaeli' },
      { id: 'p-kutahya', name: 'Kütahya' },
    ];
    const districts = [
      { id: 'd-kartepe', name: 'Kartepe', provinceId: 'p-kocaeli', province: { name: 'Kocaeli' } },
      { id: 'd-sandikli', name: 'Sandıklı', provinceId: 'p-afyon', province: { name: 'Afyonkarahisar' } },
      { id: 'd-merkez', name: 'Kütahya Merkez', provinceId: 'p-kutahya', province: { name: 'Kütahya' } },
    ];
    const prisma = {
      province: {
        findMany: jest.fn(async () => provinces),
        findFirst: jest.fn(),
      },
      district: {
        findMany: jest.fn(async (args?: { where?: { provinceId?: string } }) => {
          const provinceId = args?.where?.provinceId;
          if (provinceId) return districts.filter((row) => row.provinceId === provinceId);
          return districts;
        }),
        findFirst: jest.fn(),
      },
    };

    it('Afyon kısa adını Afyonkarahisar iline çevirir', async () => {
      await expect(resolveProvinceDistrictIds(prisma, 'Afyon', 'Sandıklı')).resolves.toEqual({
        provinceId: 'p-afyon',
        districtId: 'd-sandikli',
        provinceName: 'Afyonkarahisar',
        districtName: 'Sandıklı',
      });
    });

    it('Kartepe ilçe adından Kocaeli ilini bulur', async () => {
      await expect(resolveProvinceDistrictIds(prisma, 'Kartepe', null)).resolves.toEqual({
        provinceId: 'p-kocaeli',
        districtId: 'd-kartepe',
        provinceName: 'Kocaeli',
        districtName: 'Kartepe',
      });
    });

    it('Kutahya ASCII yazımını Kütahya olarak çözer', async () => {
      await expect(resolveProvinceDistrictIds(prisma, 'Kutahya', null)).resolves.toEqual({
        provinceId: 'p-kutahya',
        districtId: null,
        provinceName: 'Kütahya',
        districtName: null,
      });
    });
  });
});
