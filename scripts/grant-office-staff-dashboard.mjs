#!/usr/bin/env node
/** Canlıda office_staff rolüne dashboard.view izni ekler (idempotent). */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.findUnique({ where: { code: 'office_staff' } });
  const permission = await prisma.permission.findUnique({ where: { code: 'dashboard.view' } });

  if (!role || !permission) {
    console.error('ROL veya İZİN bulunamadı:', { role: !!role, permission: !!permission });
    process.exit(1);
  }

  await prisma.rolePermission.createMany({
    data: [{ roleId: role.id, permissionId: permission.id }],
    skipDuplicates: true,
  });

  console.log('OK: office_staff → dashboard.view');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
