import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense-categories.dto';

const SEED_DATA = [
  {
    name: 'Yönetim Giderleri',
    code: 'YON',
    sortOrder: 1,
    children: [
      { name: 'Aidat Ödemeleri', code: 'YON_AIDAT', sortOrder: 1 },
      { name: 'Abonelik Ödemeleri', code: 'YON_ABONELIK', sortOrder: 2 },
      { name: 'Vergi Ödemeleri', code: 'YON_VERGI', sortOrder: 3 },
      { name: 'Kira Ödemeleri', code: 'YON_KIRA', sortOrder: 4 },
      { name: 'Banka Giderleri – EFT', code: 'YON_BANKA_EFT', sortOrder: 5 },
      { name: 'Banka Giderleri – Komisyon', code: 'YON_BANKA_KOM', sortOrder: 6 },
      { name: 'Seyahat Giderleri', code: 'YON_SEYAHAT', sortOrder: 7 },
      { name: 'Yemek/Kırtasiye/Kargo Giderleri', code: 'YON_YKK', sortOrder: 8 },
      { name: 'Sağlık Giderleri', code: 'YON_SAGLIK', sortOrder: 9 },
      { name: 'Mutfak Yiyecek Malzeme', code: 'YON_MUTFAK', sortOrder: 10 },
      { name: 'Kredi Geri Ödemeleri', code: 'YON_KREDI', sortOrder: 11 },
      { name: 'Noter ve Tebligat Giderleri', code: 'YON_NOTER', sortOrder: 12 },
    ],
  },
  {
    name: 'Operasyon Giderleri',
    code: 'OPR',
    sortOrder: 2,
    children: [
      { name: 'Araç Giderleri – Kira', code: 'OPR_ARAC_KIRA', sortOrder: 1 },
      { name: 'Araç Giderleri – Yakıt', code: 'OPR_ARAC_YAKIT', sortOrder: 2 },
      { name: 'Araç Giderleri – Temizlik', code: 'OPR_ARAC_TEMIZ', sortOrder: 3 },
      { name: 'Nakliye & Hamaliye Ödemeleri', code: 'OPR_NAKLIYE', sortOrder: 4 },
      { name: 'Makine Ekipman Alımları', code: 'OPR_MAK_ALIM', sortOrder: 5 },
      { name: 'Makine Ekipman Kiralama', code: 'OPR_MAK_KIRA', sortOrder: 6 },
      { name: 'Hırdavat Malzeme Alımları', code: 'OPR_HIRDAVAT', sortOrder: 7 },
    ],
  },
  {
    name: 'Onarım Giderleri',
    code: 'ONR',
    sortOrder: 3,
    children: [
      { name: 'Duvar İşleri', code: 'ONR_DUVAR', sortOrder: 1 },
      { name: 'Sıva-Boya', code: 'ONR_SIVABOYA', sortOrder: 2 },
      { name: 'Marangoz & Mobilya', code: 'ONR_MARANGOZ', sortOrder: 3 },
      { name: 'Cam İşleri', code: 'ONR_CAM', sortOrder: 4 },
      { name: 'Demir Doğrama', code: 'ONR_DEMIR', sortOrder: 5 },
      { name: 'PVC Doğrama', code: 'ONR_PVC', sortOrder: 6 },
      { name: 'İzolasyon İşleri', code: 'ONR_IZOLASYON', sortOrder: 7 },
      { name: 'Elektrik İşleri', code: 'ONR_ELEKTRIK', sortOrder: 8 },
      { name: 'Su Tesisat İşleri', code: 'ONR_TESISAT', sortOrder: 9 },
      { name: 'Klima İşleri', code: 'ONR_KLIMA', sortOrder: 10 },
      { name: 'Temizlik İşleri', code: 'ONR_TEMIZLIK', sortOrder: 11 },
      { name: 'Seramik İşleri', code: 'ONR_SERAMIK', sortOrder: 12 },
      { name: 'Parke İşleri', code: 'ONR_PARKE', sortOrder: 13 },
      { name: 'Peyzaj İşleri', code: 'ONR_PEYZAJ', sortOrder: 14 },
      { name: 'Mermer İşleri', code: 'ONR_MERMER', sortOrder: 15 },
      { name: 'Asma Tavan İşleri', code: 'ONR_TAVAN', sortOrder: 16 },
      { name: 'Beton İşleri', code: 'ONR_BETON', sortOrder: 17 },
    ],
  },
  {
    name: 'MHY Özel Giderler',
    code: 'MHY',
    sortOrder: 4,
    children: [],
  },
];

@Injectable()
export class ExpenseCategoriesService {
  constructor(private prisma: PrismaService) {}

  async findTree() {
    const parents = await this.prisma.expenseCategory.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { costEntries: true } },
      },
    });
    return parents;
  }

  async findFlat() {
    return this.prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findOne(id: string) {
    const cat = await this.prisma.expenseCategory.findUnique({
      where: { id },
      include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!cat) throw new NotFoundException('Masraf kategorisi bulunamadı');
    return cat;
  }

  async create(dto: CreateExpenseCategoryDto) {
    const existing = await this.prisma.expenseCategory.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException('Bu kod zaten kullanımda');
    const nameConflict = await this.prisma.expenseCategory.findFirst({
      where: { name: dto.name, parentId: dto.parentId ?? null, isActive: true },
    });
    if (nameConflict) throw new ConflictException('Bu isimde bir kategori zaten mevcut');

    let level = 1;
    if (dto.parentId) {
      const parent = await this.prisma.expenseCategory.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Üst kategori bulunamadı');
      if (parent.level >= 2) throw new BadRequestException('En fazla 2 seviye desteklenmektedir');
      level = 2;
    }

    return this.prisma.expenseCategory.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase().replace(/\s/g, '_'),
        parentId: dto.parentId ?? null,
        level,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateExpenseCategoryDto) {
    const cat = await this.findOne(id);
    if (dto.name && dto.name !== cat.name) {
      const conflict = await this.prisma.expenseCategory.findFirst({
        where: { name: dto.name, parentId: cat.parentId, isActive: true, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Bu isimde bir kategori zaten mevcut');
    }
    return this.prisma.expenseCategory.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const activeChildren = await this.prisma.expenseCategory.count({
      where: { parentId: id, isActive: true },
    });
    if (activeChildren > 0) {
      throw new BadRequestException('Alt kategorileri olan bir kategori silinemez. Önce alt kategorileri silin veya pasife alın.');
    }
    const usageCount = await this.prisma.costEntry.count({ where: { expenseCategoryId: id } });
    if (usageCount > 0) {
      // Soft delete
      return this.prisma.expenseCategory.update({ where: { id }, data: { isActive: false } });
    }
    await this.prisma.expenseCategory.delete({ where: { id } });
    return { success: true };
  }

  async seedSystemData() {
    const results: any[] = [];

    for (const group of SEED_DATA) {
      const parent = await this.prisma.expenseCategory.upsert({
        where: { code: group.code },
        create: {
          name: group.name,
          code: group.code,
          level: 1,
          sortOrder: group.sortOrder,
        },
        update: {},
      });
      results.push(parent);

      for (const child of group.children) {
        const childCat = await this.prisma.expenseCategory.upsert({
          where: { code: child.code },
          create: {
            name: child.name,
            code: child.code,
            parentId: parent.id,
            level: 2,
            sortOrder: child.sortOrder,
          },
          update: {},
        });
        results.push(childCat);
      }
    }

    return { count: results.length, message: 'Seed tamamlandı' };
  }
}
