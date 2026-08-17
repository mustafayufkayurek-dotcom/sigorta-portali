import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { ApplyLineItemOverrideDto, CreateTakeoffRunDto } from './dto/takeoff-run.dto';
import { SmartTakeoffService } from './smart-takeoff.service';

type AuthUser = { id: string; email?: string | null; roleCode?: string; role?: { code?: string } };

function toRequestUser(user: AuthUser) {
  return {
    id: user.id,
    roleCode: user.roleCode ?? user.role?.code,
  };
}

@ApiTags('smart-takeoff')
@ApiBearerAuth()
@Controller('claim-files/:claimFileId/smart-takeoff')
@UseGuards(PermissionsGuard)
export class SmartTakeoffController {
  constructor(private readonly service: SmartTakeoffService) {}

  @Post('runs')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Akıllı metraj koşumu — SM ölçülerinden iş kalemi üret' })
  async createRun(
    @Param('claimFileId') claimFileId: string,
    @Body() dto: CreateTakeoffRunDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.createRun(claimFileId, toRequestUser(user), dto);
    return { success: true, data };
  }

  @Get('runs')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Dosya metraj koşumlarını listele' })
  async listRuns(
    @Param('claimFileId') claimFileId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.listRuns(claimFileId, toRequestUser(user));
    return { success: true, data };
  }

  @Get('runs/:runId')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Metraj koşumu detayı ve iş kalemleri' })
  async getRun(
    @Param('claimFileId') claimFileId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.getRun(claimFileId, runId, toRequestUser(user));
    return { success: true, data };
  }

  @Patch('runs/:runId/line-items/:lineItemId/override')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'İş kalemi manuel düzeltme — audit kaydı ile' })
  async applyLineItemOverride(
    @Param('claimFileId') claimFileId: string,
    @Param('runId') runId: string,
    @Param('lineItemId') lineItemId: string,
    @Body() dto: ApplyLineItemOverrideDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.applyLineItemOverride(
      claimFileId,
      runId,
      lineItemId,
      toRequestUser(user),
      dto,
    );
    return { success: true, data };
  }
}
