/**
 * Lokal: Dosya Sorumlusu (office_staff) rolüne role.view + role.manage bağlar.
 * Çalıştır: cd apps/backend && npx ts-node -r tsconfig-paths/register scripts/ensure-office-staff-role-manage.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.findFirst({
    where: { OR: [{ code: 'office_staff' }, { code: 'OFFICE_STAFF' }] },
  });
  if (!role) {
    throw new Error('office_staff rolü bulunamadı');
  }

  for (const code of ['role.view', 'role.manage'] as const) {
    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: code === 'role.view' ? 'Rolleri Görüntüle' : 'Rolleri Yönet',
        module: 'role',
        action: code === 'role.view' ? 'view' : 'manage',
      },
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: perm.id },
      },
      update: {},
      create: { roleId: role.id, permissionId: perm.id },
    });
    console.log(`${role.code} → ${code}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
