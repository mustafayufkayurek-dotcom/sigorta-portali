import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@ApiTags('bank-accounts')
@ApiBearerAuth()
@Controller('bank-accounts')
@UseGuards(PermissionsGuard)
export class BankAccountsController {
  constructor(private readonly service: BankAccountsService) {}

  @Get()
  @RequirePermissions('bank_account.view')
  @ApiOperation({ summary: 'Banka hesapları listesi' })
  async findAll() {
    const data = await this.service.findAll();
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('bank_account.view')
  @ApiOperation({ summary: 'Banka hesabı detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('bank_account.create')
  @ApiOperation({ summary: 'Yeni banka hesabı' })
  async create(@Body() dto: any) {
    const data = await this.service.create(dto);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('bank_account.update')
  @ApiOperation({ summary: 'Banka hesabı güncelle' })
  async update(@Param('id') id: string, @Body() dto: any) {
    const data = await this.service.update(id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('bank_account.delete')
  @ApiOperation({ summary: 'Banka hesabı sil' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }
}
