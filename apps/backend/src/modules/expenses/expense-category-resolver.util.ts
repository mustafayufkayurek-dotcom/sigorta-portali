import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const CODE_TO_GROUP: Record<string, string> = {
  YON: 'YONETIM_GIDERLERI',
  OPR: 'OPERASYON_GIDERLERI',
  ONR: 'ONARIM_GIDERLERI',
  MHY: 'MHY_OZEL_GIDERLER',
};

const NAME_TO_GROUP: Record<string, string> = {
  'Yönetim Giderleri': 'YONETIM_GIDERLERI',
  'Operasyon Giderleri': 'OPERASYON_GIDERLERI',
  'Onarım Giderleri': 'ONARIM_GIDERLERI',
  'MHY Özel Giderler': 'MHY_OZEL_GIDERLER',
};

export interface ResolvedExpenseCategoryFields {
  expenseGroup: string;
  expenseSubgroup: string;
  expenseCategoryId: string;
}

function mapParentToExpenseGroup(code: string, name: string): string {
  const byCode = CODE_TO_GROUP[code?.toUpperCase()];
  if (byCode) return byCode;
  const byName = NAME_TO_GROUP[name];
  if (byName) return byName;
  if (name.toLowerCase().includes('yönetim')) return 'YONETIM_GIDERLERI';
  if (name.toLowerCase().includes('operasyon')) return 'OPERASYON_GIDERLERI';
  if (name.toLowerCase().includes('onarım')) return 'ONARIM_GIDERLERI';
  if (name.toLowerCase().includes('mhy')) return 'MHY_OZEL_GIDERLER';
  return 'OPERASYON_GIDERLERI';
}

export async function resolveExpenseCategoryFields(
  prisma: PrismaService,
  categoryId: string,
): Promise<ResolvedExpenseCategoryFields> {
  const category = await prisma.expenseCategory.findUnique({
    where: { id: categoryId },
    include: { parent: true },
  });

  if (!category || !category.isActive) {
    throw new BadRequestException('Geçersiz veya pasif masraf kategorisi');
  }

  if (category.level === 1) {
    const childCount = await prisma.expenseCategory.count({
      where: { parentId: category.id, isActive: true },
    });
    if (childCount > 0) {
      throw new BadRequestException('Lütfen masraf alt grubunu seçin');
    }
    return {
      expenseGroup: mapParentToExpenseGroup(category.code, category.name),
      expenseSubgroup: category.name,
      expenseCategoryId: category.id,
    };
  }

  const parent = category.parent;
  if (!parent) {
    throw new BadRequestException('Masraf alt grubunun ana grubu bulunamadı');
  }

  return {
    expenseGroup: mapParentToExpenseGroup(parent.code, parent.name),
    expenseSubgroup: category.name,
    expenseCategoryId: category.id,
  };
}
