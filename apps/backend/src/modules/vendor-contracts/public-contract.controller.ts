import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { VendorContractsService } from './vendor-contracts.service';
import { SignContractDto } from './dto/vendor-contracts.dto';
import { Public } from '@/common/decorators/public.decorator';

@Public()
@Controller('public/vendor-contracts')
export class PublicContractController {
  constructor(private readonly svc: VendorContractsService) {}

  @Get(':token')
  async view(@Param('token') token: string) {
    return { data: await this.svc.findByToken(token) };
  }

  @Post(':token/sign')
  async sign(@Param('token') token: string, @Body() dto: SignContractDto) {
    return { data: await this.svc.signByToken(token, dto.fullName) };
  }
}
