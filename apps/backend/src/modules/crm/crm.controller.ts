import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CrmService } from './crm.service';

@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Post('relationships/summaries')
  summaries(@Body() body: any, @Req() req: any) {
    return this.crmService.getSummaries(body?.relationships ?? [], req.user);
  }

  @Get('relationships/:kind/:id/activity')
  activity(@Param('kind') kind: string, @Param('id') id: string, @Req() req: any) {
    return this.crmService.getActivity(kind, id, req.user);
  }

  @Get('relationships/:kind/:id/memory')
  memory(@Param('kind') kind: string, @Param('id') id: string, @Req() req: any) {
    return this.crmService.getMemory(kind, id, req.user);
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
