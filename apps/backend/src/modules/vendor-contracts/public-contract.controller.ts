import { Controller, Get, Post, Body, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { VendorContractsService } from './vendor-contracts.service';
import { SignContractDto } from './dto/vendor-contracts.dto';
import { Public } from '@/common/decorators/public.decorator';
import { PUBLIC_APPROVAL_TOKEN_CACHE_CONTROL } from '@sigorta/shared';

function noStore(res: Response) {
  res.setHeader('Cache-Control', PUBLIC_APPROVAL_TOKEN_CACHE_CONTROL);
  res.setHeader('Pragma', 'no-cache');
}

@Public()
@Controller('public/vendor-contracts')
export class PublicContractController {
  constructor(private readonly svc: VendorContractsService) {}

  @Get(':token')
  async view(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    return { data: await this.svc.findByToken(token) };
  }

  @Post(':token/sign')
  async sign(
    @Param('token') token: string,
    @Body() dto: SignContractDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    noStore(res);
    return { data: await this.svc.signByToken(token, dto.fullName) };
  }
}
