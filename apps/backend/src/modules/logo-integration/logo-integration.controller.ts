import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { LogoConfigService } from './services/logo-config.service';
import { LogoApiClientService } from './services/logo-api-client.service';
import { LogoSyncService } from './services/logo-sync.service';
import { UpdateLogoConfigDto } from './dto/logo-config.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { MonthlyOverheadService } from '../finance/monthly-overhead.service';

@Controller('integrations/logo')
export class LogoIntegrationController {
  constructor(
    private readonly configService: LogoConfigService,
    private readonly apiClient: LogoApiClientService,
    private readonly syncService: LogoSyncService,
    private readonly prisma: PrismaService,
    private readonly overheadService: MonthlyOverheadService,
  ) {}

  // ── Konfigürasyon ────────────────────────────────────────────────────────

  @Get('config')
  async getConfig() {
    const config = await this.configService.getConfig();
    if (!config) return { configured: false };

    const { clientSecret: _, password: __, ...safe } = config;
    return { ...safe, clientSecret: '***', password: '***' };
  }

  @Put('config')
  async updateConfig(@Body() dto: UpdateLogoConfigDto) {
    const config = await this.configService.updateConfig(dto);
    const { clientSecret: _, password: __, ...safe } = config;
    return { ...safe, clientSecret: '***', password: '***' };
  }

  // ── Bağlantı Testi ───────────────────────────────────────────────────────

  @Post('test')
  async testConnection() {
    const result = await this.apiClient.testConnection();
    await this.configService.markTestResult(result.success ? 'success' : 'failed');
    return result;
  }

  // ── Senkronizasyon Logları ───────────────────────────────────────────────

  @Get('logs')
  async getLogs(
    @Query('status') status?: string,
    @Query('entityType') entityType?: string,
    @Query('direction') direction?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: Record<string, unknown> = { provider: 'logo_wing' };
    if (status) where['status'] = status;
    if (entityType) where['entityType'] = entityType;
    if (direction) where['direction'] = direction;

    const [items, total] = await Promise.all([
      this.prisma.integrationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          entityType: true,
          entityId: true,
          direction: true,
          operation: true,
          status: true,
          endpoint: true,
          errorMessage: true,
          retryCount: true,
          logoEntityId: true,
          processedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.integrationLog.count({ where }),
    ]);

    return { items, total, page: parseInt(page), limit: parseInt(limit) };
  }

  @Get('logs/:id')
  async getLog(@Param('id') id: string) {
    return this.prisma.integrationLog.findUniqueOrThrow({ where: { id } });
  }

  @Post('logs/:id/retry')
  async retryLog(@Param('id') id: string) {
    await this.syncService.retryLog(id);
    return { message: 'Yeniden gönderim kuyruğa eklendi.' };
  }

  // ── İstatistikler ────────────────────────────────────────────────────────

  @Get('stats')
  async getStats() {
    const [total, success, failed, dead, pending] = await Promise.all([
      this.prisma.integrationLog.count({ where: { provider: 'logo_wing' } }),
      this.prisma.integrationLog.count({ where: { provider: 'logo_wing', status: 'success' } }),
      this.prisma.integrationLog.count({ where: { provider: 'logo_wing', status: 'failed' } }),
      this.prisma.integrationLog.count({ where: { provider: 'logo_wing', status: 'dead' } }),
      this.prisma.integrationLog.count({ where: { provider: 'logo_wing', status: 'pending' } }),
    ]);
    return { total, success, failed, dead, pending };
  }

  // ── P&L: Logo Wing Sabit Gider Sync (Faz 3) ─────────────────────────────

  /**
   * Logo Wing muhasebe hesaplarından aylık sabit giderleri çekip MonthlyOverheadEntry
   * olarak kaydeder. categoryMapping config'e göre hesap kodunu ExpenseCategory.code'a eşler.
   *
   * POST /integrations/logo/overhead-sync
   * body: { year, month }
   */
  @Post('overhead-sync')
  async syncOverheadFromLogo(@Body() body: { year: number; month: number }) {
    const { year, month } = body;

    if (!year || !month || month < 1 || month > 12) {
      throw new BadRequestException('Geçerli yıl ve ay (1-12) giriniz');
    }

    const config = await this.configService.getConfig();
    if (!config || !config.isEnabled) {
      throw new BadRequestException('Logo Wing entegrasyonu etkin değil');
    }

    const categoryMapping: Record<string, string> = (config as any).categoryMapping ?? {};

    // Logo API'den genel gider muhasebe hareketlerini çek
    // Gerçek implementasyonda LogoApiClientService üzerinden çekilir.
    // Bu placeholder gerçek API çağrısını simüle eder.
    const overheadData = await this.fetchLogoOverheadData(year, month, categoryMapping);

    const results: Array<{ category: string; amount: number; logoRef: string }> = [];

    for (const entry of overheadData) {
      try {
        await this.overheadService.createEntry(
          {
            year,
            month,
            expenseCategoryId: entry.expenseCategoryId,
            amount: entry.amount,
            description: entry.description,
            source: 'logo_erp',
            logoEntryRef: entry.logoRef,
          },
          'logo_sync',
        );
        results.push({ category: entry.categoryCode, amount: entry.amount, logoRef: entry.logoRef });
      } catch {
        // Zaten girilmiş/dağıtılmış ise atla
      }
    }

    return {
      synced: results.length,
      year,
      month,
      entries: results,
    };
  }

  private async fetchLogoOverheadData(
    year: number,
    month: number,
    categoryMapping: Record<string, string>,
  ): Promise<Array<{
    expenseCategoryId: string;
    categoryCode: string;
    amount: number;
    description: string;
    logoRef: string;
  }>> {
    // Logo Wing API çağrısı placeholder
    // Gerçek implementasyon: this.apiClient.get('/api/v1/accounting/monthly-expenses', { year, month })
    // Dönen hesap kodlarını categoryMapping ile eşle
    const categories = await this.prisma.expenseCategory.findMany({
      where: { code: { in: Object.values(categoryMapping) } },
      select: { id: true, code: true },
    });
    const codeToId = new Map(categories.map((c) => [c.code, c.id]));

    return Object.entries(categoryMapping)
      .map(([logoAccountCode, categoryCode]) => {
        const id = codeToId.get(categoryCode);
        if (!id) return null;
        return {
          expenseCategoryId: id,
          categoryCode,
          amount: 0, // gerçek Logo API'den gelecek
          description: `Logo Wing — ${logoAccountCode} — ${year}/${String(month).padStart(2, '0')}`,
          logoRef: `${logoAccountCode}-${year}-${month}`,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.amount > 0);
  }
}
