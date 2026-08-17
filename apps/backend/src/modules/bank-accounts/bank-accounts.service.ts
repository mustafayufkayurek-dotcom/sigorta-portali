import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.bankAccount.findMany({
      orderBy: { bankName: 'asc' },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Banka hesabı bulunamadı');
    return account;
  }

  async create(dto: {
    bankName: string;
    branchName?: string;
    iban: string;
    currency?: string;
    isActive?: boolean;
  }) {
    return this.prisma.bankAccount.create({ data: dto });
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
  ) {
    await this.findOne(id);
    return this.prisma.bankAccount.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.bankAccount.delete({ where: { id } });
  }
}
