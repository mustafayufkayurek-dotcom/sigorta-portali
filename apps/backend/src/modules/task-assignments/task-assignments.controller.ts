import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { TaskAssignmentsService } from './task-assignments.service';
import {
  CreateTaskAssignmentDto,
  FilterTaskAssignmentsDto,
  RejectTaskAssignmentDto,
  BulkApproveDto,
  AutoAssignDto,
  EscalationRules,
} from './dto/task-assignments.dto';

@Controller('task-assignments')
export class TaskAssignmentsController {
  constructor(private readonly service: TaskAssignmentsService) {}

  @Get()
  async findAll(@Query() filters: FilterTaskAssignmentsDto) {
    const data = await this.service.findAll(filters);
    return { data };
  }

  @Get('pending-approvals')
  async findPendingApprovals() {
    const data = await this.service.findPendingApprovals();
    return { data };
  }

  /** Ekip iş yükü — Personel Performans Yönetimi kartları */
  @Get('team-workload')
  async getTeamWorkload() {
    const data = await this.service.getTeamWorkload();
    return { data };
  }

  /**
   * Personel performans KPI (Tümü / seçili personel).
   * detail=written|approved|revenue|profit → satır listesi
   */
  @Get('performance-kpis')
  async getPerformanceKpis(
    @Query('userId') userId?: string,
    @Query('detail') detail?: 'written' | 'approved' | 'revenue' | 'profit',
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const data = await this.service.getPerformanceKpis({
      userId,
      detail,
      period,
      dateFrom,
      dateTo,
    });
    return { data };
  }

  @Get('workload/:userId')
  async getWorkload(@Param('userId') userId: string) {
    const data = await this.service.getWorkload(userId);
    return { data };
  }

  // ─── Bildirim Endpoint'leri ───────────────────────────────────────────────

  @Get('notifications')
  async getNotifications(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.service.getNotifications(userId, limit ? parseInt(limit, 10) : 20);
    return { data };
  }

  @Get('notifications/unread-count')
  async getUnreadCount(@Query('userId') userId: string) {
    const data = await this.service.getUnreadCount(userId);
    return { data };
  }

  @Patch('notifications/:id/read')
  async markNotificationRead(@Param('id') id: string) {
    const data = await this.service.markNotificationRead(id);
    return { data };
  }

  @Patch('notifications/read-all')
  async markAllNotificationsRead(@Body() body: { userId: string }) {
    const data = await this.service.markAllNotificationsRead(body.userId);
    return { data };
  }

  // ─── Geciken Dosyalar ─────────────────────────────────────────────────────

  @Get('overdue')
  async getOverdueAssignments() {
    const data = await this.service.getOverdueAssignments();
    return { data };
  }

  // ─── Eskalasyon Kuralları ─────────────────────────────────────────────────

  @Get('escalation-rules')
  async getEscalationRules() {
    const data = await this.service.getEscalationRules();
    return { data };
  }

  @Put('escalation-rules')
  async setEscalationRules(@Body() body: EscalationRules) {
    const data = await this.service.setEscalationRules(body);
    return { data };
  }

  @Post()
  async create(@Body() dto: CreateTaskAssignmentDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    const data = await this.service.approve(id);
    return { data };
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body() dto: RejectTaskAssignmentDto) {
    const data = await this.service.reject(id, dto);
    return { data };
  }

  @Patch('bulk-approve')
  async bulkApprove(@Body() dto: BulkApproveDto) {
    const data = await this.service.bulkApprove(dto);
    return { data };
  }

  @Post('auto-assign')
  async autoAssign(@Body() dto: AutoAssignDto) {
    const data = await this.service.autoAssign(dto);
    return { data };
  }
}
