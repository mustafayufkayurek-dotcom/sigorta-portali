import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateRegionDto, SetAdjustmentDto, BulkAdjustmentDto } from './dto/regions.dto';

@Injectable()
export class RegionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const regions = await this.prisma.region.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        adjustments: {
          orderBy: { effectiveDate: 'desc' },
          take: 1,
        },
      },
    });
    return regions.map((r) => ({
      ...r,
      latestAdjustment: r.adjustments[0] ?? null,
      adjustments: undefined,
    }));
  }

  async findOne(id: string) {
    const region = await this.prisma.region.findUnique({
      where: { id },
      include: {
        adjustments: {
          orderBy: { effectiveDate: 'desc' },
          take: 1,
        },
      },
    });
    if (!region) throw new NotFoundException('Bölge bulunamadı');
    return { ...region, latestAdjustment: region.adjustments[0] ?? null };
  }

  async create(dto: CreateRegionDto) {
    const code = dto.code.toUpperCase().replace(/\s+/g, '_');
    const existing = await this.prisma.region.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`"${code}" kodlu bölge zaten mevcut`);
    return this.prisma.region.create({
      data: { name: dto.name, code },
    });
  }

  async setAdjustment(regionId: string, dto: SetAdjustmentDto, userId?: string) {
    const region = await this.prisma.region.findUnique({ where: { id: regionId } });
    if (!region) throw new NotFoundException('Bölge bulunamadı');

    return this.prisma.regionalPriceAdjustment.create({
      data: {
        regionId,
        adjustmentPercent: dto.adjustmentPercent,
        effectiveDate: new Date(dto.effectiveDate),
        notes: dto.notes,
        createdByUserId: userId,
      },
    });
  }

  async bulkAdjustment(dto: BulkAdjustmentDto, userId?: string) {
    const results: any[] = [];
    for (const regionId of dto.regionIds) {
      const region = await this.prisma.region.findUnique({ where: { id: regionId } });
      if (!region) continue;
      const adj = await this.prisma.regionalPriceAdjustment.create({
        data: {
          regionId,
          adjustmentPercent: dto.adjustmentPercent,
          effectiveDate: new Date(dto.effectiveDate),
          notes: dto.notes,
          createdByUserId: userId,
        },
      });
      results.push({ regionId, regionName: region.name, adjustment: adj });
    }
    return { applied: results.length, results };
  }

  async getAdjustmentHistory(regionId: string) {
    const region = await this.prisma.region.findUnique({ where: { id: regionId } });
    if (!region) throw new NotFoundException('Bölge bulunamadı');

    const history = await this.prisma.regionalPriceAdjustment.findMany({
      where: { regionId },
      orderBy: { effectiveDate: 'desc' },
    });

    return { region, history };
  }

  async seed() {
    const regions = [
      { name: 'Marmara', code: 'MARMARA' },
      { name: 'Ege', code: 'EGE' },
      { name: 'Akdeniz', code: 'AKDENIZ' },
      { name: 'İç Anadolu', code: 'IC_ANADOLU' },
      { name: 'Karadeniz', code: 'KARADENIZ' },
      { name: 'Doğu Anadolu', code: 'DOGU_ANADOLU' },
      { name: 'Güneydoğu Anadolu', code: 'GUNEYDOGU_ANADOLU' },
    ];

    let created = 0;
    let skipped = 0;

    for (const r of regions) {
      const existing = await this.prisma.region.findUnique({ where: { code: r.code } });
      if (!existing) {
        await this.prisma.region.create({ data: r });
        created++;
      } else {
        skipped++;
      }
    }

    return { created, skipped, message: 'Türkiye bölgeleri yüklendi' };
  }
}
