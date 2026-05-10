import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerAccessLogService } from './customer-access-log.service';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';

@ApiTags('customer-access-logs')
@ApiBearerAuth()
@Controller('customer-access-logs')
@UseGuards(PermissionsGuard)
export class CustomerAccessLogController {
  constructor(private readonly service: CustomerAccessLogService) {}

  @Get()
  @RequirePermissions('customer.view')
  @ApiOperation({ summary: 'Müşteri erişim loglarını listele' })
  async findAll(
    @Query('userId') userId?: string,
    @Query('customerId') customerId?: string,
    @Query('accessType') accessType?: string,
    @Query('isAnomaly') isAnomaly?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.service.findAll({
      userId,
      customerId,
      accessType,
      isAnomaly: isAnomaly !== undefined ? isAnomaly === 'true' : undefined,
      fromDate,
      toDate,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get('stats')
  @RequirePermissions('customer.view')
  @ApiOperation({ summary: 'Erişim istatistikleri' })
  async getStats() {
    const data = await this.service.getStats();
    return { success: true, data };
  }
}
