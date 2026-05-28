import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
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
  async listPending(
    @Query('approverType') approverType?: string,
    @Query('approverId') approverId?: string,
    @Query('includeExpired') includeExpired?: string,
  ) {
    return this.service.listPending(approverType, approverId, includeExpired === 'true');
  }

  @Get('external-approvals/:id')
  async getDetail(@Param('id') id: string) {
    return this.service.getDetail(id);
  }

  // ── Authenticated onay yanıtlama (portal kullanıcıları için) ─────────────

  @Post('external-approvals/:id/respond-auth')
  async respondAuth(
    @Param('id') id: string,
    @Body() dto: RespondExternalApprovalDto,
    @CurrentUser() user: any,
  ) {
    return this.service.respondAuth(id, dto, user.id);
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
