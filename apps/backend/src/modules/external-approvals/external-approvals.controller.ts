import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { ExternalApprovalsService } from './external-approvals.service';
import { SendExternalApprovalDto, RespondExternalApprovalDto } from './dto/external-approvals.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';

@Controller()
export class ExternalApprovalsController {
  constructor(private readonly service: ExternalApprovalsService) {}

  // ── Gönderim (auth gerekir) ───────────────────────────────────────────────

  @Post('repair-reports/:reportId/send-external-approval')
  async send(
    @Param('reportId') reportId: string,
    @Body() dto: SendExternalApprovalDto,
    @CurrentUser() user: any,
  ) {
    return this.service.send(reportId, dto, user.id);
  }

  // ── Raporun dış onay listesi (auth gerekir) ───────────────────────────────

  @Get('repair-reports/:reportId/external-approvals')
  async listByReport(@Param('reportId') reportId: string) {
    return this.service.listByReport(reportId);
  }

  // ── Bekleyen onaylar listesi — altyapı (auth gerekir) ────────────────────

  @Get('external-approvals/pending')
  listPending(
    @Query('approverType') approverType?: string,
    @Query('approverId') approverId?: string,
    @Query('includeExpired') includeExpired?: string,
    @CurrentUser() user?: {
      id?: string;
      userId?: string;
      roleCode?: string;
      insuranceCompanyScopes?: string[];
      assistantCustomerScopes?: string[];
    },
  ) {
    const role = user?.roleCode?.toLowerCase();
    const userId = user?.id ?? user?.userId;
    if (role === 'insurance_company_user' && user?.insuranceCompanyScopes?.length) {
      return this.service.listPendingForInsuranceCompanies(
        user.insuranceCompanyScopes,
        includeExpired === 'true',
      );
    }
    if (role === 'assistance_company_user' && user?.assistantCustomerScopes?.length) {
      return this.service.listPendingForAssistantCustomers(
        user.assistantCustomerScopes,
        includeExpired === 'true',
      );
    }
    if (role === 'expert' && userId) {
      if (approverId && approverId !== userId) {
        throw new ForbiddenException('Yalnızca kendi onay listenize erişebilirsiniz');
      }
      return this.service.listPending(approverType, userId, includeExpired === 'true');
    }
    return this.service.listPending(approverType, approverId, includeExpired === 'true');
  }

  @Get('external-approvals/:id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser() user?: {
      id?: string;
      roleCode?: string;
      insuranceCompanyScopes?: string[];
    },
  ) {
    return this.service.getDetail(id, user);
  }

  // ── Authenticated onay yanıtlama (portal kullanıcıları için) ─────────────

  @Post('external-approvals/:id/respond-auth')
  async respondAuth(
    @Param('id') id: string,
    @Body() dto: RespondExternalApprovalDto,
    @CurrentUser() user: {
      id: string;
      roleCode?: string;
      insuranceCompanyScopes?: string[];
    },
  ) {
    return this.service.respondAuth(id, dto, user);
  }

  // ── Public endpointler (token bazlı, login gerektirmez) ──────────────────

  @Public()
  @Get('external-approvals/token/:token')
  async getByToken(@Param('token') token: string) {
    return this.service.getByToken(token);
  }

  @Public()
  @Post('external-approvals/:token/respond')
  async respond(
    @Param('token') token: string,
    @Body() dto: RespondExternalApprovalDto,
  ) {
    return this.service.respond(token, dto);
  }
}
