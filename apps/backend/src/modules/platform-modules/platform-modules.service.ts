import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export const PLATFORM_MODULE_CODES = {
  PERSONNEL: 'personnel',
  FIXED_ASSETS: 'fixed_assets',
} as const;

@Injectable()
export class PlatformModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.platformModule.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async findByCode(code: string) {
    const row = await this.prisma.platformModule.findUnique({ where: { code } });
    if (!row) throw new NotFoundException(`Modül bulunamadı: ${code}`);
    return row;
  }

  async isEnabled(code: string): Promise<boolean> {
    const row = await this.prisma.platformModule.findUnique({ where: { code } });
    return row?.isEnabled ?? false;
  }

  async assertEnabled(code: string): Promise<void> {
    const enabled = await this.isEnabled(code);
    if (!enabled) {
      throw new NotFoundException('Bu modül henüz etkin değil.');
    }
  }

  async setEnabled(code: string, isEnabled: boolean) {
    await this.findByCode(code);
    return this.prisma.platformModule.update({
      where: { code },
      data: { isEnabled },
    });
  }
}
