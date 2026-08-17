import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const DEFAULT_SERVICE_TYPES = [
  { name: 'Hasar Onarım',           sortOrder: 1 },
  { name: 'Restorasyon',            sortOrder: 2 },
  { name: 'Güneş Enerjisi Onarım', sortOrder: 3 },
  { name: 'Sovtaj',                 sortOrder: 4 },
  { name: 'İş Makinası İade Parça', sortOrder: 5 },
  { name: 'Elektronik İade Parça',  sortOrder: 6 },
  { name: 'Danışmanlık',            sortOrder: 7 },
];

@Injectable()
export class ServiceTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.serviceType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAllActive() {
    return this.prisma.serviceType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: { name: string; description?: string; isActive?: boolean; sortOrder?: number }) {
    const existing = await this.prisma.serviceType.findUnique({ where: { name: data.name } });
    if (existing) throw new ConflictException('Bu isimde bir hizmet türü zaten mevcut');
    return this.prisma.serviceType.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const existing = await this.prisma.serviceType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Hizmet türü bulunamadı');
    if (data.name && data.name !== existing.name) {
      const conflict = await this.prisma.serviceType.findFirst({
        where: { name: data.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Bu isimde bir hizmet türü zaten mevcut');
    }
    return this.prisma.serviceType.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.serviceType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Hizmet türü bulunamadı');
    await this.prisma.serviceType.delete({ where: { id } });
    return { message: 'Hizmet türü silindi' };
  }

  async seed() {
    let created = 0;
    for (const st of DEFAULT_SERVICE_TYPES) {
      const exists = await this.prisma.serviceType.findUnique({ where: { name: st.name } });
      if (!exists) {
        await this.prisma.serviceType.create({ data: { ...st, isActive: true } });
        created++;
      }
    }
    const total = await this.prisma.serviceType.count();
    return { message: 'Seed tamamlandı', created, total };
  }
}
