import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(private prisma: PrismaService) {}

  async findAllProvinces() {
    return this.prisma.province.findMany({
      orderBy: { plateCode: 'asc' },
      select: { id: true, plateCode: true, name: true },
    });
  }

  async findDistrictsByProvince(provinceId: string) {
    return this.prisma.district.findMany({
      where: { provinceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, provinceId: true },
    });
  }

  /**
   * UI "Muş Merkez" / OSM "Merkez" gibi isim farklarını mahalle sorgusunda birleştirir.
   */
  districtNameAliases(provinceName: string, districtName: string): string[] {
    const province = provinceName.trim();
    const district = districtName.trim();
    if (!district) return [];
    const aliases = new Set<string>([district]);
    const lower = district.toLocaleLowerCase('tr-TR');

    if (lower.endsWith(' merkez')) {
      aliases.add('Merkez');
      const withoutMerkez = district.replace(/\s+Merkez$/i, '').trim();
      if (withoutMerkez) aliases.add(withoutMerkez);
      if (province) aliases.add(province);
    }
    if (lower === 'merkez' && province) {
      aliases.add(`${province} Merkez`);
      aliases.add(province);
    }
    if (province && lower === province.toLocaleLowerCase('tr-TR')) {
      aliases.add('Merkez');
      aliases.add(`${province} Merkez`);
    }

    return [...aliases];
  }

  async findNeighborhoodsByNames(provinceName: string, districtName: string) {
    if (!provinceName.trim() || !districtName.trim()) {
      return [];
    }
    const province = await this.prisma.province.findFirst({
      where: { name: { equals: provinceName, mode: 'insensitive' } },
    });
    if (!province) {
      this.logger.warn(`Mahalle sorgusu: il bulunamadı (${provinceName})`);
      return [];
    }

    const aliases = this.districtNameAliases(province.name, districtName);
    let district =
      (await this.prisma.district.findFirst({
        where: {
          provinceId: province.id,
          name: { equals: districtName, mode: 'insensitive' },
        },
      })) ?? null;

    if (!district) {
      for (const alias of aliases) {
        if (alias.toLocaleLowerCase('tr-TR') === districtName.trim().toLocaleLowerCase('tr-TR')) {
          continue;
        }
        district = await this.prisma.district.findFirst({
          where: {
            provinceId: province.id,
            name: { equals: alias, mode: 'insensitive' },
          },
        });
        if (district) break;
      }
    }

    if (!district) {
      this.logger.warn(`Mahalle sorgusu: ilçe bulunamadı (${provinceName}/${districtName})`);
      return [];
    }

    const cached = await this.prisma.neighborhood.findMany({
      where: { districtId: district.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    if (cached.length > 0) {
      return cached;
    }

    const overpassNames = this.districtNameAliases(province.name, district.name);
    let fetched: string[] = [];
    for (const osmDistrictName of overpassNames) {
      fetched = await this.fetchNeighborhoodsFromOverpass(province.name, osmDistrictName);
      if (fetched.length > 0) break;
    }

    if (fetched.length > 0) {
      await this.prisma.neighborhood.createMany({
        data: fetched.map((name) => ({ districtId: district.id, name })),
        skipDuplicates: true,
      });
      return this.prisma.neighborhood.findMany({
        where: { districtId: district.id },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
    }

    return [];
  }

  /** Nominatim sunucu tarafı arama — tarayıcı CORS / User-Agent kısıtlarını aşar. */
  async geocodeQuery(query: string): Promise<{
    lat: number;
    lng: number;
    displayName: string;
  } | null> {
    const q = query.trim();
    if (!q) return null;
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}` +
        `&countrycodes=tr&limit=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'MeridyenAssistance/1.0 (locations-geocode)',
          Accept: 'application/json',
          'Accept-Language': 'tr',
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
      }>;
      if (!Array.isArray(data) || data.length === 0 || !data[0].lat || !data[0].lon) {
        return null;
      }
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name ?? q,
      };
    } catch (err) {
      this.logger.warn(`Geocode başarısız (${q}): ${err}`);
      return null;
    }
  }

  private async fetchNeighborhoodsFromOverpass(
    provinceName: string,
    districtName: string,
  ): Promise<string[]> {
    const query = `[out:json][timeout:20];
area["name"="${this.escapeOverpass(provinceName)}"]["admin_level"="4"]->.p;
area["name"="${this.escapeOverpass(districtName)}"]["admin_level"~"6|7|8"](area.p)->.d;
(
  node["place"~"neighbourhood|suburb|quarter"](area.d);
  way["place"~"neighbourhood|suburb|quarter"](area.d);
  relation["place"~"neighbourhood|suburb|quarter"](area.d);
);
out tags;`;

    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MeridyenAssistance/1.0 (locations-service)',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        elements?: Array<{ tags?: { name?: string } }>;
      };
      const names = (json.elements ?? [])
        .map((el) => el.tags?.name?.trim())
        .filter((name): name is string => !!name && name.length > 1);
      return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'tr'));
    } catch (err) {
      this.logger.warn(`Overpass mahalle sorgusu başarısız (${provinceName}/${districtName}): ${err}`);
      return [];
    }
  }

  private escapeOverpass(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}
