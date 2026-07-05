import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { PlatformModulesService, PLATFORM_MODULE_CODES } from '@/modules/platform-modules/platform-modules.service';
import { RequirePlatformModule, PlatformModuleGuard } from '@/common/guards/platform-module.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { HrService } from './hr.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { ConfirmAttendanceDayDto, ConfirmAttendanceMonthDto } from './dto/confirm-attendance.dto';
import { SendAttendanceAccountantDto } from './dto/send-attendance-accountant.dto';
import { HrAttendanceExportService } from './hr-attendance-export.service';
import { HrAttendanceReminderService } from './hr-attendance-reminder.service';

@Controller('hr')
@UseGuards(PlatformModuleGuard)
export class HrController {
  constructor(
    private readonly platformModules: PlatformModulesService,
    private readonly hrService: HrService,
    private readonly hrAttendanceExport: HrAttendanceExportService,
    private readonly hrAttendanceReminder: HrAttendanceReminderService,
  ) {}

  @Get('status')
  @Public()
  async publicStatus() {
    const enabled = await this.platformModules.isEnabled(PLATFORM_MODULE_CODES.PERSONNEL);
    return {
      data: {
        module: PLATFORM_MODULE_CODES.PERSONNEL,
        enabled,
        phase: 'ozluk_scaffold',
        capabilities: ['attendance', 'leave', 'leave_approval', 'summary', 'documents', 'attendance_export', 'attendance_month_close_reminder', 'attendance_clock_times', 'attendance_signature'],
      },
    };
  }

  @Get('summary')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.view')
  async summary(@CurrentUser() user: { id: string; roleCode?: string; permissions?: string[] }) {
    const data = await this.hrService.getSummary(user);
    return { data };
  }

  @Get('attendance')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.view')
  async attendance(
    @CurrentUser() user: { id: string },
    @Query('year') yearStr?: string,
    @Query('month') monthStr?: string,
  ) {
    const now = new Date();
    const year = yearStr ? Number(yearStr) : now.getFullYear();
    const month = monthStr ? Number(monthStr) : now.getMonth() + 1;
    const data = await this.hrService.listAttendance(user, year, month);
    return { data };
  }

  @Get('attendance/month-close-reminders')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.view', 'invoice.view', 'report.view')
  async monthCloseReminders(
    @CurrentUser() user: { id: string; roleCode?: string; permissions?: string[] },
  ) {
    const data = await this.hrAttendanceReminder.getMonthCloseReminders(user);
    return { data };
  }

  @Get('attendance/export')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.view')
  async exportAttendance(
    @CurrentUser() user: { id: string },
    @Res() res: Response,
    @Query('year') yearStr?: string,
    @Query('month') monthStr?: string,
    @Query('format') format: 'xlsx' | 'print' = 'xlsx',
  ) {
    const now = new Date();
    const year = yearStr ? Number(yearStr) : now.getFullYear();
    const month = monthStr ? Number(monthStr) : now.getMonth() + 1;
    await this.hrAttendanceExport.exportAttendance(user, year, month, format ?? 'xlsx', res);
  }

  @Post('attendance/send-accountant')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.view', 'hr.attendance.manage')
  async sendToAccountant(
    @CurrentUser() user: { id: string },
    @Body() dto: SendAttendanceAccountantDto,
  ) {
    const result = await this.hrAttendanceExport.sendToAccountant(user, dto);
    return { data: result };
  }

  @Post('attendance/confirm-day')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.view')
  async confirmDay(
    @CurrentUser() user: { id: string },
    @Body() dto: ConfirmAttendanceDayDto,
  ) {
    const data = await this.hrService.confirmAttendanceDay(user, dto);
    return { data };
  }

  @Post('attendance/confirm-month')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.view')
  async confirmMonth(
    @CurrentUser() user: { id: string },
    @Body() dto: ConfirmAttendanceMonthDto,
  ) {
    const data = await this.hrService.confirmAttendanceMonth(user, dto);
    return { data };
  }

  @Post('attendance/lock-month')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.attendance.manage', 'hr.leave.approve')
  async lockMonth(
    @CurrentUser() user: { id: string; roleCode?: string; permissions?: string[] },
    @Body() dto: ConfirmAttendanceMonthDto,
  ) {
    const data = await this.hrService.lockAttendanceMonth(user, dto);
    return { data };
  }

  @Post('attendance')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.attendance.manage', 'hr.view')
  async upsertAttendance(
    @CurrentUser() user: { id: string },
    @Body() dto: UpsertAttendanceDto,
  ) {
    const data = await this.hrService.upsertAttendance(user, dto);
    return { data };
  }

  @Get('leave-balances')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.view')
  async leaveBalances(@CurrentUser() user: { id: string }) {
    const data = await this.hrService.getLeaveBalances(user);
    return { data };
  }

  @Get('leave-requests/pending-approval')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.leave.approve')
  async pendingApprovals(
    @CurrentUser() user: { id: string; roleCode?: string; permissions?: string[] },
  ) {
    const data = await this.hrService.listPendingApprovals(user);
    return { data };
  }

  @Get('leave-requests')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.view')
  async myLeaveRequests(@CurrentUser() user: { id: string }) {
    const data = await this.hrService.listMyLeaveRequests(user);
    return { data };
  }

  @Post('leave-requests')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.leave.request', 'hr.view')
  async createLeaveRequest(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateLeaveRequestDto,
  ) {
    const data = await this.hrService.createLeaveRequest(user, dto);
    return { data };
  }

  @Patch('leave-requests/:id/submit')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.leave.request', 'hr.view')
  async submitLeaveRequest(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    const data = await this.hrService.submitLeaveRequest(user, id);
    return { data };
  }

  @Patch('leave-requests/:id/approve')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.leave.approve')
  async approveLeaveRequest(
    @CurrentUser() user: { id: string; roleCode?: string; permissions?: string[] },
    @Param('id') id: string,
  ) {
    const data = await this.hrService.approveLeaveRequest(user, id);
    return { data };
  }

  @Patch('leave-requests/:id/reject')
  @RequirePlatformModule(PLATFORM_MODULE_CODES.PERSONNEL)
  @RequirePermissions('hr.leave.approve')
  async rejectLeaveRequest(
    @CurrentUser() user: { id: string; roleCode?: string; permissions?: string[] },
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
  ) {
    const data = await this.hrService.rejectLeaveRequest(user, id, dto.rejectionReason);
    return { data };
  }
}
