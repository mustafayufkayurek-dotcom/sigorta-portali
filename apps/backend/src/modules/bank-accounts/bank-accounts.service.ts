import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PartyAccountsService } from '@/modules/finance/party-accounts.service';
import { bankaCariKodu } from '@sigorta/shared';

@Injectable()
export class BankAccountsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private partyAccounts?: PartyAccountsService,
  ) {}

  async findAll() {
    const rows = await this.prisma.bankAccount.findMany({
      orderBy: { bankName: 'asc' },
    });
    if (!rows.length) return rows;
    const codes = rows.map((r) => bankaCariKodu(r.id));
    const cariler = await this.prisma.partyAccount.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true, name: true, isActive: true },
    });
    const byCode = new Map(cariler.map((c) => [c.code, c]));
    return rows.map((row) => {
      const cari = byCode.get(bankaCariKodu(row.id));
      return {
        ...row,
        partyAccountId: cari?.id ?? null,
        partyAccountName: cari?.name ?? null,
      };
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Banka hesabı bulunamadı');
    const cari = await this.prisma.partyAccount.findFirst({
      where: { code: bankaCariKodu(id) },
      select: { id: true, name: true },
    });
    return {
      ...account,
      partyAccountId: cari?.id ?? null,
      partyAccountName: cari?.name ?? null,
    };
  }

  async create(
    dto: {
      bankName: string;
      branchName?: string;
      iban: string;
      currency?: string;
      isActive?: boolean;
    },
    userId?: string | null,
  ) {
    const created = await this.prisma.bankAccount.create({ data: dto });
    if (userId && this.partyAccounts) {
      try {
        await this.partyAccounts.ensureBankAccount({
          bankAccountId: created.id,
          userId,
          isActive: created.isActive,
        });
      } catch {
        /* cari sonradan tahsilatta açılır */
      }
    }
    return this.findOne(created.id);
  }

  async update(
    id: string,
    dto: {
      bankName?: string;
      branchName?: string;
      iban?: string;
      currency?: string;
      isActive?: boolean;
    },
    userId?: string | null,
  ) {
    await this.findOne(id);
    const updated = await this.prisma.bankAccount.update({ where: { id }, data: dto });
    if (userId && this.partyAccounts) {
      try {
        await this.partyAccounts.ensureBankAccount({
          bankAccountId: updated.id,
          userId,
          isActive: updated.isActive,
        });
      } catch {
        /* liste yine banka kaydını gösterir */
      }
    }
    return this.findOne(updated.id);
  }

  async remove(id: string) {
    await this.findOne(id);
    const code = bankaCariKodu(id);
    await this.prisma.partyAccount.updateMany({
      where: { code },
      data: { isActive: false },
    });
    return this.prisma.bankAccount.delete({ where: { id } });
  }
}
