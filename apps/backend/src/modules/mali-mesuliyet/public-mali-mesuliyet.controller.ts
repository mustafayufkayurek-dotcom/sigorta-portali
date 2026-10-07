import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { PUBLIC_APPROVAL_TOKEN_CACHE_CONTROL } from '@sigorta/shared';
import { MaliMesuliyetService } from './mali-mesuliyet.service';

function noStore(res: Response) {
  res.setHeader('Cache-Control', PUBLIC_APPROVAL_TOKEN_CACHE_CONTROL);
  res.setHeader('Pragma', 'no-cache');
}

@Public()
@Controller('public/mali-mesuliyet')
export class PublicMaliMesuliyetController {
  constructor(private readonly service: MaliMesuliyetService) {}

  @Get(':token')
  async findByToken(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    const data = await this.service.findByToken(token);
    return { success: true, data };
  }

  @Post(':token/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('token') token: string,
    @Body() body: { fullName?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    noStore(res);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket?.remoteAddress;
    const data = await this.service.approveByToken(token, body.fullName ?? '', ip);
    return { success: true, data };
  }

  @Post(':token/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('token') token: string,
    @Body() body: { reason?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    noStore(res);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket?.remoteAddress;
    const data = await this.service.rejectByToken(token, body.reason ?? '', ip);
    return { success: true, data };
  }
}
