import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { FileDocumentsService } from './file-documents.service';
import { ApproveFileDocumentDto } from './dto/file-documents.dto';

@Public()
@Controller('public/evrak')
export class PublicFileDocumentController {
  constructor(private readonly service: FileDocumentsService) {}

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.service.findByToken(token);
  }

  @Post(':token/viewed')
  @HttpCode(HttpStatus.OK)
  markViewed(@Param('token') token: string, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket?.remoteAddress;
    return this.service.markViewed(token, ip);
  }

  @Post(':token/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('token') token: string,
    @Body() dto: ApproveFileDocumentDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket?.remoteAddress;
    return this.service.approveByToken(token, dto.fullName, ip);
  }
}
