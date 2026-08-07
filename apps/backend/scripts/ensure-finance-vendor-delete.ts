/**
 * Lokal: Finans rolüne vendor.delete bağlar (idempotent).
 * Çalıştır: cd apps/backend && npx ts-node -r tsconfig-paths/register scripts/ensure-finance-vendor-delete.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const perm = await prisma.permission.upsert({
    where: { code: 'vendor.delete' },
    update: { name: 'Tedarikçi Sil', module: 'vendor', action: 'delete' },
    create: {
      code: 'vendor.delete',
      name: 'Tedarikçi Sil',
      module: 'vendor',
      action: 'delete',
    },
  });

  for (const code of ['vendor.view', 'vendor.create', 'vendor.update'] as const) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name:
          code === 'vendor.view'
            ? 'Tedarikçileri Görüntüle'
            : code === 'vendor.create'
              ? 'Tedarikçi Oluştur'
              : 'Tedarikçi Güncelle',
        module: 'vendor',
        action: code.split('.')[1],
      },
    });
  }

  const finance = await prisma.role.findFirst({
    where: { OR: [{ code: 'finance' }, { code: 'finans' }, { code: 'FINANCE' }, { code: 'FINANS' }] },
  });
  if (!finance) {
    console.error('Finans rolü bulunamadı');
    process.exit(1);
  }

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: { roleId: finance.id, permissionId: perm.id },
    },
    update: {},
    create: { roleId: finance.id, permissionId: perm.id },
  });

  console.log(`OK: ${finance.code} → vendor.delete`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
