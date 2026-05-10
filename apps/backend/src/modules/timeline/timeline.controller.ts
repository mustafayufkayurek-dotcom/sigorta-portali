import { Controller, Get, Post, Patch, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { CreateWaitingDto, CreateTimelineNoteDto } from './dto/timeline.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('claim-files')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get(':id/timeline')
  async getTimeline(@Param('id') id: string) {
    return this.timelineService.getTimeline(id);
  }

  @Get(':id/current-stage')
  async getCurrentStage(@Param('id') id: string) {
    return this.timelineService.getCurrentStage(id);
  }

  @Post(':id/waiting')
  async createWaiting(
    @Param('id') id: string,
    @Body() dto: CreateWaitingDto,
    @Req() req: any,
  ) {
    return this.timelineService.createWaiting(id, req.user.id, dto.reason, dto.description);
  }

  @Patch(':id/waiting/:waitingId/resolve')
  async resolveWaiting(
    @Param('waitingId') waitingId: string,
    @Req() req: any,
  ) {
    return this.timelineService.resolveWaiting(waitingId, req.user.id);
  }

  // Ek Talep #5: İç Not Sistemi
  @Get(':id/notes')
  async getNotes(@Param('id') id: string) {
    return this.timelineService.getNotes(id);
  }

  @Post(':id/notes')
  async createNote(
    @Param('id') id: string,
    @Body() dto: CreateTimelineNoteDto,
    @Req() req: any,
  ) {
    return this.timelineService.createNote(id, req.user.id, dto.content, dto.noteType);
  }

  // Ek Talep #2: Hareketsiz dosya listesi
  @Get('reports/inactive-files')
  async getInactiveFiles(@Query('hours') hours?: string) {
    const threshold = hours ? parseInt(hours, 10) : 48;
    return this.timelineService.getInactiveFiles(threshold);
  }
}
