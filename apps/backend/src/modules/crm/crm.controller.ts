import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CrmService } from './crm.service';

@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Post('relationships/summaries')
  summaries(@Body() body: any, @Req() req: any) {
    return this.crmService.getSummaries(body?.relationships ?? [], req.user);
  }

  @Get('my-silent-offices')
  async mySilentOffices(@Req() req: any) {
    const data = await this.crmService.getMySilentExpertOffices(req.user);
    return { success: true, data };
  }

  @Get('my-silent-assistance')
  async mySilentAssistance(@Req() req: any) {
    const data = await this.crmService.getMySilentAssistanceCustomers(req.user);
    return { success: true, data };
  }

  @Get('silence-action-report')
  async silenceActionReport(@Req() req: any) {
    const data = await this.crmService.getSilenceActionReport(req.user);
    return { success: true, data };
  }

  @Post('silence-warning/dismiss')
  async dismissSilenceWarning(@Body() body: any, @Req() req: any) {
    const data = await this.crmService.recordSilenceWarningSignal('dismissed', req.user, body?.officeIds);
    return { success: true, data };
  }

  @Post('silence-warning/opened')
  async openedSilenceWarning(@Body() body: any, @Req() req: any) {
    const data = await this.crmService.recordSilenceWarningSignal('opened', req.user, body?.officeIds);
    return { success: true, data };
  }

  @Get('relationships/:kind/:id/activity')
  activity(@Param('kind') kind: string, @Param('id') id: string, @Req() req: any) {
    return this.crmService.getActivity(kind, id, req.user);
  }

  @Get('relationships/:kind/:id/memory')
  memory(@Param('kind') kind: string, @Param('id') id: string, @Req() req: any) {
    return this.crmService.getMemory(kind, id, req.user);
  }

  @Post('relationships/expert-work')
  async expertWork(@Body() body: any) {
    const data = await this.crmService.getExpertWorkMap(body?.ids ?? []);
    return { success: true, data };
  }

  @Post('relationships/:kind/:id/notes')
  createNote(@Param('kind') kind: string, @Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.crmService.createNote(kind, id, body, req.user);
  }

  @Post('relationships/:kind/:id/follow-ups')
  createFollowUp(@Param('kind') kind: string, @Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.crmService.createFollowUp(kind, id, body, req.user);
  }

  @Patch('relationships/:kind/:id/status')
  updateStatus(@Param('kind') kind: string, @Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.crmService.updateStatus(kind, id, body, req.user);
  }

  @Patch('relationships/:kind/:id/follow-ups/:followUpId')
  updateFollowUp(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.crmService.updateFollowUp(kind, id, followUpId, body, req.user);
  }

  @Post('relationships/:kind/:id/email')
  sendEmail(@Param('kind') kind: string, @Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.crmService.sendEmail(kind, id, body, req.user);
  }
}
