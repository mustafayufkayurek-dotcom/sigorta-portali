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

    const district = await this.prisma.district.findFirst({
      where: {
        provinceId: province.id,
        name: { equals: districtName, mode: 'insensitive' },
      },
    });
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

    const fetched = await this.fetchNeighborhoodsFromOverpass(province.name, district.name);
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
