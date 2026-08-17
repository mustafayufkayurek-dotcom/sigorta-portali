import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateLogoConfigDto } from '../dto/logo-config.dto';
import { IntegrationProvider } from '../types/integration.enums';

export interface LogoConfigData {
  id: string;
  isEnabled: boolean;
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  firmNo: number;
  companyCodePrefix: string | null;
  lastTestedAt: Date | null;
  testStatus: string | null;
}

@Injectable()
export class LogoConfigService implements OnModuleInit {
  private readonly logger = new Logger(LogoConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultConfig();
  }

  private async ensureDefaultConfig() {
    const existing = await this.prisma.integrationConfig.findUnique({
      where: { provider: IntegrationProvider.LOGO_WING },
    });

    if (!existing) {
      const apiBaseUrl = this.configService.get<string>('LOGO_API_BASE_URL');
      if (!apiBaseUrl) return;

      await this.prisma.integrationConfig.create({
        data: {
          provider: IntegrationProvider.LOGO_WING,
          isEnabled: this.configService.get<string>('LOGO_INTEGRATION_ENABLED') === 'true',
          apiBaseUrl,
          clientId: this.configService.get<string>('LOGO_API_CLIENT_ID', ''),
          clientSecret: this.configService.get<string>('LOGO_API_CLIENT_SECRET', ''),
          username: this.configService.get<string>('LOGO_API_USERNAME', ''),
          password: this.configService.get<string>('LOGO_API_PASSWORD', ''),
          firmNo: parseInt(this.configService.get<string>('LOGO_FIRM_NO', '1'), 10),
          companyCodePrefix: this.configService.get<string>('LOGO_COMPANY_CODE_PREFIX', 'SHS_'),
        },
      });
      this.logger.log('Logo Wing varsayılan konfigürasyonu oluşturuldu.');
    }
  }

  async getConfig(): Promise<LogoConfigData | null> {
    return this.prisma.integrationConfig.findUnique({
      where: { provider: IntegrationProvider.LOGO_WING },
    });
  }

  async updateConfig(dto: UpdateLogoConfigDto): Promise<LogoConfigData> {
    return this.prisma.integrationConfig.upsert({
      where: { provider: IntegrationProvider.LOGO_WING },
      create: {
        provider: IntegrationProvider.LOGO_WING,
        ...dto,
      },
      update: dto,
    });
  }

  async markTestResult(status: 'success' | 'failed'): Promise<void> {
    await this.prisma.integrationConfig.update({
      where: { provider: IntegrationProvider.LOGO_WING },
      data: {
        testStatus: status,
        lastTestedAt: new Date(),
      },
    });
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config?.isEnabled ?? false;
  }
}
