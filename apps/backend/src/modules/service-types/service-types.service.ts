import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { toTitleCaseTR } from '@/common/utils/text-helpers';
import {
  CONSULTANCY_SERVICE_FAMILY,
  HASAR_TESPIT_SERVICE_CODE,
  HASAR_TESPIT_SERVICE_NAME,
} from '@sigorta/shared';

const DEFAULT_SERVICE_TYPES = [
  { name: 'Hasar Onarım',           sortOrder: 1 },
  { name: 'Restorasyon',            sortOrder: 2 },
  { name: 'Güneş Enerjisi Onarım', sortOrder: 3 },
  { name: 'Sovtaj',                 sortOrder: 4 },
  { name: 'İş Makinası İade Parça', sortOrder: 5 },
  { name: 'Elektronik İade Parça',  sortOrder: 6 },
  { name: 'Danışmanlık',            sortOrder: 7 },
];

function slugConsultancyCode(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

@Injectable()
export class ServiceTypesService {
  constructor(private prisma: PrismaService) {}

  async ensureHasarTespit() {
    const existing = await this.prisma.serviceType.findFirst({
      where: {
        OR: [
          { code: HASAR_TESPIT_SERVICE_CODE },
          { name: HASAR_TESPIT_SERVICE_NAME },
        ],
      },
    });
    if (existing) {
      if (
        existing.family === CONSULTANCY_SERVICE_FAMILY
        && existing.code === HASAR_TESPIT_SERVICE_CODE
        && existing.isSystem
        && existing.isActive
      ) {
        return existing;
      }
      return this.prisma.serviceType.update({
        where: { id: existing.id },
        data: {
          name: HASAR_TESPIT_SERVICE_NAME,
          family: CONSULTANCY_SERVICE_FAMILY,
          code: HASAR_TESPIT_SERVICE_CODE,
          isSystem: true,
          isActive: true,
          sortOrder: existing.sortOrder || 1,
        },
      });
    }
    return this.prisma.serviceType.create({
      data: {
        name: HASAR_TESPIT_SERVICE_NAME,
        family: CONSULTANCY_SERVICE_FAMILY,
        code: HASAR_TESPIT_SERVICE_CODE,
        isSystem: true,
        isActive: true,
        sortOrder: 1,
      },
    });
  }

  async findAll(family?: string) {
    if (family === CONSULTANCY_SERVICE_FAMILY) {
      await this.ensureHasarTespit();
    }
    return this.prisma.serviceType.findMany({
      where: family ? { family } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAllActive(family?: string) {
    if (family === CONSULTANCY_SERVICE_FAMILY) {
      await this.ensureHasarTespit();
    }
    return this.prisma.serviceType.findMany({
      where: { isActive: true, ...(family ? { family } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: { name: string; description?: string; isActive?: boolean; sortOrder?: number }) {
    const name = toTitleCaseTR(String(data.name ?? '').trim());
    if (!name) throw new BadRequestException('Hizmet türü adı zorunludur');
    if (name.toLocaleLowerCase('tr-TR') === HASAR_TESPIT_SERVICE_NAME.toLocaleLowerCase('tr-TR')) {
      throw new ConflictException('Hasar Tespit zaten kayıtlıdır');
    }
    const code = slugConsultancyCode(name);
    if (!code) throw new BadRequestException('Hizmet türü adı zorunludur');
    const existing = await this.prisma.serviceType.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) throw new ConflictException('Bu isimde bir hizmet türü zaten mevcut');
    const max = await this.prisma.serviceType.aggregate({
      where: { family: CONSULTANCY_SERVICE_FAMILY },
      _max: { sortOrder: true },
    });
    return this.prisma.serviceType.create({
      data: {
        name,
        family: CONSULTANCY_SERVICE_FAMILY,
        code,
        description: data.description?.trim() || null,
        isActive: data.isActive ?? true,
        isSystem: false,
        sortOrder: data.sortOrder ?? (max._max.sortOrder ?? 1) + 1,
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const existing = await this.prisma.serviceType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Hizmet türü bulunamadı');
    if (existing.isSystem) {
      if (data.name && toTitleCaseTR(data.name.trim()) !== existing.name) {
        throw new BadRequestException('Hasar Tespit adı değiştirilemez');
      }
      if (data.isActive === false) {
        throw new BadRequestException('Hasar Tespit kapatılamaz');
      }
      return this.prisma.serviceType.update({
        where: { id },
        data: {
          description: data.description !== undefined ? (data.description.trim() || null) : undefined,
          sortOrder: data.sortOrder,
        },
      });
    }
    const name = data.name != null ? toTitleCaseTR(data.name.trim()) : undefined;
    if (name && name !== existing.name) {
      const conflict = await this.prisma.serviceType.findFirst({
        where: { name, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Bu isimde bir hizmet türü zaten mevcut');
    }
    return this.prisma.serviceType.update({
      where: { id },
      data: {
        name,
        description: data.description !== undefined ? (data.description.trim() || null) : undefined,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.serviceType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Hizmet türü bulunamadı');
    if (existing.isSystem) throw new BadRequestException('Hasar Tespit silinemez');
    await this.prisma.serviceType.delete({ where: { id } });
    return { message: 'Hizmet türü silindi' };
  }

  async seed() {
    let created = 0;
    for (const st of DEFAULT_SERVICE_TYPES) {
      const exists = await this.prisma.serviceType.findUnique({ where: { name: st.name } });
      if (!exists) {
        await this.prisma.serviceType.create({ data: { ...st, isActive: true, family: 'legacy' } });
        created++;
      }
    }
    await this.ensureHasarTespit();
    const total = await this.prisma.serviceType.count();
    return { message: 'Seed tamamlandı', created, total };
  }
}
