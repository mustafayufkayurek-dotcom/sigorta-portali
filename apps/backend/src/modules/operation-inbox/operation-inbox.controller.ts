import { BadRequestException, Body, Controller, Get, Param, Post, Query, Request } from '@nestjs/common';
import { InboundMailbox, InboundMessageStatus } from '@prisma/client';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { SystemSettingsService, M365GraphConfig } from '../system-settings/system-settings.service';
import { AssignMessageDto } from './dto/assign-message.dto';
import { OpenClaimFileDto } from './dto/open-claim-file.dto';
import { OpenEmergencyFileDto } from './dto/open-emergency-file.dto';
import { GraphAuthService } from './graph/graph-auth.service';
import { GraphSubscriptionService } from './graph/graph-subscription.service';
import { OperationInboxService } from './operation-inbox.service';
import { LinkClaimFileDto } from './dto/link-claim-file.dto';
import { LinkEmergencyFileDto } from './dto/link-emergency-file.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { ComposeMessageDto } from './dto/compose-message.dto';

@Controller('operation-inbox')
export class OperationInboxController {
  constructor(
    private readonly inboxService: OperationInboxService,
    private readonly graphAuth: GraphAuthService,
    private readonly systemSettings: SystemSettingsService,
    private readonly graphSubscriptions: GraphSubscriptionService,
  ) {}

  @Post('test-connection')
  @RequirePermissions('settings.manage')
  async testConnection(@Body() body: Partial<M365GraphConfig> = {}) {
    const saved = await this.systemSettings.getM365GraphConfig();
    const tenantId = (body.tenantId ?? saved.tenantId)?.trim();
    const clientId = (body.clientId ?? saved.clientId)?.trim();
    const clientSecret =
      body.clientSecret && body.clientSecret !== '***'
        ? body.clientSecret
        : saved.clientSecret;
    const ihbarMailbox = (body.ihbarMailbox ?? saved.ihbarMailbox)?.trim() || 'ihbar@safranbh.com';
    const hasarMailbox = (body.hasarMailbox ?? saved.hasarMailbox)?.trim() || 'hasar@safranbh.com';

    if (!tenantId || !clientId || !clientSecret) {
      throw new BadRequestException(
        'Kiracı kimliği, uygulama kimliği ve gizli anahtar zorunludur.',
      );
    }
    if (clientSecret.length < 20 || clientSecret.includes('***')) {
      throw new BadRequestException(
        'Kayıtlı gizli anahtar geçersiz. Azure → Sertifikalar → Değer sütununu form alanına yapıştırıp tekrar test edin.',
      );
    }

    const result = await this.graphAuth.testConnection(
      { tenantId, clientId, clientSecret },
      [
        { address: ihbarMailbox, label: 'İhbar' },
        { address: hasarMailbox, label: 'Hasar' },
      ],
    );

    const updated: M365GraphConfig = {
      ...saved,
      tenantId,
      clientId,
      clientSecret,
      ihbarMailbox,
      hasarMailbox,
      lastTestAt: new Date().toISOString(),
      lastTestSuccess: result.success,
      lastTestMessage: result.message,
    };
    await this.systemSettings.setM365GraphConfig(updated);

    if (updated.active && result.success) {
      void this.graphSubscriptions.ensureSubscriptions().catch(() => undefined);
    }

    return { success: result.success, data: result };
  }

  @Get('stats')
  @RequirePermissions('operation_inbox.view')
  getStats() {
    return this.inboxService.getStats();
  }

  @Get('messages')
  @RequirePermissions('operation_inbox.view')
  listMessages(
    @Query('mailbox') mailbox?: InboundMailbox,
    @Query('status') status?: InboundMessageStatus,
    @Query('actionQueue') actionQueue?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.inboxService.listMessages({
      mailbox,
      status,
      actionQueue: actionQueue === 'false' ? false : actionQueue === 'true' ? true : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('messages/reprocess-matching')
  @RequirePermissions('operation_inbox.manage')
  reprocessMatching(@Query('limit') limit?: string) {
    return this.inboxService.reprocessMatching(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('messages/by-claim/:claimFileId')
  @RequirePermissions('operation_inbox.view')
  listByClaimFile(@Param('claimFileId') claimFileId: string) {
    return this.inboxService.listByClaimFile(claimFileId);
  }

  @Get('messages/by-emergency/:emergencyCaseId')
  @RequirePermissions('operation_inbox.view')
  listByEmergencyCase(@Param('emergencyCaseId') emergencyCaseId: string) {
    return this.inboxService.listByEmergencyCase(emergencyCaseId);
  }

  @Get('messages/:id/match-candidates')
  @RequirePermissions('operation_inbox.view')
  getMatchCandidates(@Param('id') id: string) {
    return this.inboxService.getMatchCandidates(id);
  }

  @Get('assignable-users')
  @RequirePermissions('operation_inbox.view')
  listAssignableUsers(@Query('messageId') messageId?: string) {
    return this.inboxService.listAssignableUsers(messageId);
  }

  @Get('messages/:id/routing-suggestion')
  @RequirePermissions('operation_inbox.view')
  getRoutingSuggestion(@Param('id') id: string) {
    return this.inboxService.getRoutingSuggestion(id);
  }

  @Get('messages/:id/auto-assign-preview')
  @RequirePermissions('operation_inbox.view')
  getAutoAssignPreview(@Param('id') id: string) {
    return this.inboxService.getAutoAssignPreview(id);
  }

  @Get('messages/:id')
  @RequirePermissions('operation_inbox.view')
  getMessage(@Param('id') id: string) {
    return this.inboxService.getMessage(id);
  }

  @Post('messages/:id/archive')
  @RequirePermissions('operation_inbox.manage')
  archiveMessage(@Param('id') id: string) {
    return this.inboxService.archiveMessage(id);
  }

  @Post('messages/:id/reply')
  @RequirePermissions('operation_inbox.manage')
  replyMessage(
    @Param('id') id: string,
    @Body() dto: ReplyMessageDto,
    @Request() req: { user?: { id?: string } },
  ) {
    return this.inboxService.replyMessage(id, dto, req.user?.id);
  }

  @Post('compose')
  @RequirePermissions('operation_inbox.manage')
  composeMessage(
    @Body() dto: ComposeMessageDto,
    @Request() req: { user?: { id?: string } },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Oturum kullanıcısı bulunamadı');
    }
    return this.inboxService.composeMessage(dto, userId);
  }

  @Post('messages/:id/assign')
  @RequirePermissions('operation_inbox.manage')
  assignMessage(@Param('id') id: string, @Body() dto: AssignMessageDto) {
    return this.inboxService.assignMessage(id, dto);
  }

  @Post('messages/:id/link-claim-file')
  @RequirePermissions('operation_inbox.manage')
  linkClaimFile(@Param('id') id: string, @Body() dto: LinkClaimFileDto) {
    return this.inboxService.linkClaimFile(id, dto);
  }

  @Post('messages/:id/link-emergency-file')
  @RequirePermissions('operation_inbox.manage')
  linkEmergencyFile(@Param('id') id: string, @Body() dto: LinkEmergencyFileDto) {
    return this.inboxService.linkEmergencyFile(id, dto);
  }

  @Post('messages/:id/open-claim-file')
  @RequirePermissions('operation_inbox.manage')
  openClaimFile(
    @Param('id') id: string,
    @Body() dto: OpenClaimFileDto,
    @Request() req: { user?: { id?: string } },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Oturum kullanıcısı bulunamadı');
    }
    return this.inboxService.openClaimFile(id, dto, userId);
  }

  @Post('messages/:id/open-emergency-file')
  @RequirePermissions('operation_inbox.manage')
  openEmergencyFile(
    @Param('id') id: string,
    @Body() dto: OpenEmergencyFileDto,
    @Request() req: { user?: { id?: string } },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Oturum kullanıcısı bulunamadı');
    }
    return this.inboxService.openEmergencyFile(id, dto, userId);
  }

  @Post('sync')
  @RequirePermissions('operation_inbox.manage', 'operation_inbox.settings')
  triggerSync() {
    return this.inboxService.triggerSync();
  }
}
