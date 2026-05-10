import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateMarketPriceDto, UpdateMarketPriceDto, MarketPriceQueryDto } from './dto/market-prices.dto';

@Injectable()
export class MarketPricesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: MarketPriceQueryDto) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.workGroupId) where.workGroupId = params.workGroupId;
    if (params.regionType) where.regionType = params.regionType;
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.jobDescription = { contains: params.search, mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.marketPriceCatalog.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ workGroupId: 'asc' }, { jobDescription: 'asc' }, { regionType: 'asc' }],
        include: {
          workGroup: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.marketPriceCatalog.count({ where }),
    ]);

    return { data: rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const item = await this.prisma.marketPriceCatalog.findUnique({
      where: { id },
      include: { workGroup: { select: { id: true, code: true, name: true } } },
    });
    if (!item) throw new NotFoundException('Piyasa rayici kaydı bulunamadı');
    return item;
  }

  async lookup(workGroupId: string, jobDescription?: string, regionType?: string) {
    const region = regionType || 'national';

    const where: any = {
      workGroupId,
      isActive: true,
      validFrom: { lte: new Date() },
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    };
    if (jobDescription) {
      where.jobDescription = { contains: jobDescription, mode: 'insensitive' };
    }

    // Region önceliği: belirtilen > national
    const exactMatch = await this.prisma.marketPriceCatalog.findFirst({
      where: { ...where, regionType: region },
      orderBy: { validFrom: 'desc' },
    });

    if (exactMatch) return exactMatch;

    if (region !== 'national') {
      return this.prisma.marketPriceCatalog.findFirst({
        where: { ...where, regionType: 'national' },
        orderBy: { validFrom: 'desc' },
      });
    }

    return null;
  }

  async lookupByCity(workGroupId: string, city: string, jobDescription?: string) {
    const regionType = this.cityToRegion(city);
    return this.lookup(workGroupId, jobDescription, regionType);
  }

  cityToRegion(city: string): string {
    const istanbulCities = ['istanbul', 'İstanbul'];
    const normalized = city?.toLowerCase().replace('i̇', 'i') || '';
    if (istanbulCities.map((c) => c.toLowerCase()).includes(normalized)) return 'istanbul';
    return 'anatolian';
  }

  async create(dto: CreateMarketPriceDto) {
    return this.prisma.marketPriceCatalog.create({
      data: {
        workGroupId: dto.workGroupId,
        jobDescription: dto.jobDescription,
        unit: dto.unit || 'adet',
        regionType: dto.regionType || 'national',
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        referencePrice: dto.referencePrice,
        tolerancePct: dto.tolerancePct ?? 15,
        source: dto.source || 'internal',
        validFrom: new Date(dto.validFrom),
        validTo: dto.validTo ? new Date(dto.validTo) : null,
      },
      include: { workGroup: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateMarketPriceDto) {
    await this.findOne(id);
    return this.prisma.marketPriceCatalog.update({
      where: { id },
      data: {
        ...(dto.minPrice !== undefined && { minPrice: dto.minPrice }),
        ...(dto.maxPrice !== undefined && { maxPrice: dto.maxPrice }),
        ...(dto.referencePrice !== undefined && { referencePrice: dto.referencePrice }),
        ...(dto.tolerancePct !== undefined && { tolerancePct: dto.tolerancePct }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.validFrom !== undefined && { validFrom: new Date(dto.validFrom) }),
        ...(dto.validTo !== undefined && { validTo: dto.validTo ? new Date(dto.validTo) : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.regionType !== undefined && { regionType: dto.regionType }),
      },
      include: { workGroup: { select: { id: true, code: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.marketPriceCatalog.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Kayıt devre dışı bırakıldı' };
  }

  async bulkCreate(items: CreateMarketPriceDto[]) {
    const created = await Promise.all(items.map((item) => this.create(item)));
    return { created: created.length, items: created };
  }
}
