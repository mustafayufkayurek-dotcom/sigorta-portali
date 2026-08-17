import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { OperationalAccessGrantsService } from './operational-access-grants.service';
import {
  CreateOperationalAccessGrantDto,
  OPERATIONAL_SCOPE_TYPES,
} from './dto/operational-access-grants.dto';

@ApiTags('operational-access-grants')
@ApiBearerAuth()
@Controller('operational-access-grants')
@UseGuards(PermissionsGuard)
export class OperationalAccessGrantsController {
  constructor(private readonly service: OperationalAccessGrantsService) {}

  private assertAdminOrManager(user: any) {
    const role = String(user?.roleCode ?? user?.role?.code ?? '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') {
      throw new ForbiddenException('Bu işlem yalnızca yönetici kullanıcılar içindir');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Kullanıcıya göre vekalet listesi' })
  async listByUser(@Query('granteeUserId') granteeUserId: string, @CurrentUser() user: any) {
    this.assertAdminOrManager(user);
    if (!granteeUserId) {
      throw new ForbiddenException('granteeUserId parametresi gerekli');
    }
    const data = await this.service.listByGrantee(granteeUserId);
    return { success: true, data };
  }

  @Get('function-delegates')
  @ApiOperation({ summary: 'Aktif fonksiyon vekaletli kullanıcılar' })
  async listFunctionDelegates(@Query('scopeType') scopeType: string) {
    const normalized = OPERATIONAL_SCOPE_TYPES.includes(scopeType as any)
      ? (scopeType as (typeof OPERATIONAL_SCOPE_TYPES)[number])
      : 'acil_yardim';
    const data = await this.service.listActiveFunctionDelegates(normalized);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Yeni vekalet oluştur' })
  async create(@Body() dto: CreateOperationalAccessGrantDto, @CurrentUser() user: any) {
    this.assertAdminOrManager(user);
    const grantedByUserId = user?.id ?? user?.userId;
    const data = await this.service.create(dto, grantedByUserId);
    return { success: true, data };
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Vekaleti pasifleştir' })
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    this.assertAdminOrManager(user);
    const data = await this.service.deactivate(id);
    return { success: true, data };
  }
}
