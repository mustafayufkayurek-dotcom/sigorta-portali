import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { AgreementsService } from './agreements.service';
import { CreateAgreementDto, UpdateAgreementDto, AcceptAgreementDto } from './dto/agreements.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { resolveUserId } from '@/common/utils/resolve-user-id';

@Controller()
export class AgreementsController {
  constructor(private readonly service: AgreementsService) {}

  // Admin: tüm sözleşmeler
  @Get('agreements')
  @RequirePermissions('agreement.manage')
  async findAll() {
    const data = await this.service.findAll();
    return { data };
  }

  // Aktif sözleşmeleri listele (herkes erişebilir)
  @Get('agreements/active')
  async findActive() {
    const data = await this.service.findActive();
    return { data };
  }

  // Mevcut kullanıcının onaylaması gereken sözleşmeler
  @Get('agreements/pending')
  async getPending(@CurrentUser() user: any) {
    const data = await this.service.getPendingForUser(resolveUserId(user));
    return { data };
  }

  // Mevcut kullanıcının kabul ettiği sözleşmeler
  @Get('agreements/my-acceptances')
  async myAcceptances(@CurrentUser() user: any) {
    const data = await this.service.getUserAcceptances(resolveUserId(user));
    return { data };
  }

  @Get('agreements/:id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  // Sözleşmeyi kabul etmiş kullanıcılar (admin)
  @Get('agreements/:id/acceptances')
  @RequirePermissions('agreement.manage')
  async getAcceptances(@Param('id') id: string) {
    const data = await this.service.getAcceptances(id);
    return { data };
  }

  @Post('agreements')
  @RequirePermissions('agreement.manage')
  async create(@Body() dto: CreateAgreementDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  // Sözleşmeyi onayla
  @Post('agreements/accept')
  async accept(@CurrentUser() user: any, @Body() dto: AcceptAgreementDto, @Req() req: any) {
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    const userAgent = req.headers['user-agent'] ?? null;
    const data = await this.service.accept(resolveUserId(user), dto, ipAddress, userAgent);
    return { data };
  }

  @Patch('agreements/:id')
  @RequirePermissions('agreement.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateAgreementDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete('agreements/:id')
  @RequirePermissions('agreement.manage')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
