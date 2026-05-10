import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('payments')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('payments')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Ödeme listesi' })
  async findAll(@Query() query: any) {
    const result = await this.service.findAll(query);
    return { success: true, ...result };
  }

  @Get('payments/:id')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Ödeme detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { success: true, data };
  }

  @Post('payments')
  @RequirePermissions('payment.create')
  @ApiOperation({ summary: 'Yeni ödeme kaydet' })
  async create(@Body() dto: CreatePaymentDto, @CurrentUser() user: any) {
    const data = await this.service.create(dto, user.id);
    return { success: true, data };
  }

  @Patch('payments/:id')
  @RequirePermissions('payment.update')
  @ApiOperation({ summary: 'Ödeme güncelle' })
  async update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    const data = await this.service.update(id, dto);
    return { success: true, data };
  }

  @Get('claim-files/:id/payments')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Dosya ödemeleri' })
  async getByClaimFile(@Param('id') claimFileId: string, @Query() query: any) {
    const result = await this.service.findAll({ ...query, claimFileId });
    return { success: true, ...result };
  }
}
