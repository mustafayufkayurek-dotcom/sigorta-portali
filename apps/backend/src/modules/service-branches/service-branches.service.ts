import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const HASAR_BRANCHES = [
  'Dahili Su',
  'Yangın',
  'Hırsızlık',
  'Doğal Afet',
  'Fırtına',
  'Dolu',
  'Deprem',
  'Cam Kırılması',
  'Sel/Su Baskını',
  'Terör',
  'Elektronik Cihaz',
  'Makine Kırılması',
];

const ACIL_YARDIM_BRANCHES = [
  'Konut Çilingir',
  'Araç Çilingir',
  'Tesisat',
  'Elektrik',
  'Cam',
  'Çatı',
  'Su Kesimi',
  'Beyaz Eşya Arıza',
  'Kombi/Klima',
  'Haşere İlaçlama',
];

@Injectable()
export class ServiceBranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(type?: string) {
    const where: any = { isActive: true };
    if (type) where.type = type;
    return this.prisma.serviceBranch.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAllAdmin(type?: string) {
    const where: any = {};
    if (type) where.type = type;
    return this.prisma.serviceBranch.findMany({
      where,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: { name: string; type: string; sortOrder?: number }) {
    const existing = await this.prisma.serviceBranch.findFirst({
      where: { name: data.name, type: data.type },
    });
    if (existing) throw new ConflictException('Bu isimde bir branş zaten mevcut');
    return this.prisma.serviceBranch.create({
      data: {
        name: data.name,
        type: data.type,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, data: { name?: string; type?: string; isActive?: boolean; sortOrder?: number }) {
    const existing = await this.prisma.serviceBranch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Branş bulunamadı');
    if (data.name && data.name !== existing.name) {
      const conflict = await this.prisma.serviceBranch.findFirst({
        where: { name: data.name, type: data.type ?? existing.type, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Bu isimde bir branş zaten mevcut');
    }
    return this.prisma.serviceBranch.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.serviceBranch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Branş bulunamadı');
    await this.prisma.serviceBranch.delete({ where: { id } });
    return { message: 'Branş silindi' };
  }

  async seed() {
    const existing = await this.prisma.serviceBranch.count();
    if (existing > 0) return { message: 'Zaten seed edilmiş', count: existing };

    const hasarData = HASAR_BRANCHES.map((name, i) => ({ name, type: 'hasar', sortOrder: i }));
    const acilData = ACIL_YARDIM_BRANCHES.map((name, i) => ({ name, type: 'acil_yardim', sortOrder: i }));

    await this.prisma.serviceBranch.createMany({ data: [...hasarData, ...acilData] });
    const count = await this.prisma.serviceBranch.count();
    return { message: 'Seed tamamlandı', count };
  }
}
