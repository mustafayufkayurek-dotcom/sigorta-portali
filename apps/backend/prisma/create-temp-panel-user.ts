/**
 * Geçici panel kullanıcısı oluşturur — mevcut admin şifresine dokunmaz.
 * Kullanım: cd apps/backend && pnpm exec ts-node prisma/create-temp-panel-user.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

function generatePassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomBytes(3).toString('hex');
  const email = `gecici.nav.${stamp}.${suffix}@meridyen-test.local`;
  const password = generatePassword();
  const employeeCode = `TMPNAV${suffix.toUpperCase()}`.slice(0, 20);

  const adminRole = await prisma.role.findUnique({ where: { code: 'admin' } });
  if (!adminRole) {
    throw new Error('Admin rolü bulunamadı. Önce seed çalıştırılmalı.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      firstName: 'Geçici',
      lastName: 'Navigasyon Test',
      email,
      passwordHash,
      roleId: adminRole.id,
      status: 'active',
      isWebUser: true,
      isMobileUser: false,
      employeeCode,
    },
  });

  const activeAgreements = await prisma.agreement.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  if (activeAgreements.length > 0) {
    await prisma.agreementAcceptance.createMany({
      data: activeAgreements.map((agreement) => ({
        userId: user.id,
        agreementId: agreement.id,
        signature: 'Geçici Navigasyon Test',
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    JSON.stringify(
      {
        email,
        password,
        userId: user.id,
        role: 'admin',
        note: 'Geçici kullanıcı — test bitince silinebilir. Admin hesabına dokunulmadı.',
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hata: ${message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
