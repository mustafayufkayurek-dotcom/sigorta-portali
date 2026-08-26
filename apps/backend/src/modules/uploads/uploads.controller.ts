import { Controller, Post, Get, Query, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
@UseGuards(PermissionsGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Presigned URL oluştur' })
  async presign(@Body() dto: any) {
    const data = await this.uploadsService.generatePresignedUrl(dto);
    return { success: true, data };
  }

  @Post('file-assets/complete')
  @ApiOperation({ summary: 'Dosya yükleme tamamlandı - FileAsset kaydı oluştur' })
  async complete(@Body() dto: any, @CurrentUser() user: any) {
    const data = await this.uploadsService.completeUpload(dto, user.id);
    return { success: true, data };
  }

  @Get('file')
  @ApiOperation({ summary: 'Depolanan dosyayı oturumla akıt (302 yok)' })
  async streamFile(@Query('storageKey') storageKey: string, @Res() res: Response) {
    const { buffer, mimeType } = await this.uploadsService.getFileBuffer(storageKey);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(buffer);
  }

  @Get('signed-url')
  @ApiOperation({ summary: 'FileAsset için signed URL döndür (15dk geçerli)' })
  async getSignedUrl(@Query('storageKey') storageKey: string) {
    const url = await this.uploadsService.getSignedUrl(storageKey, 900);
    return { success: true, data: { url, expiresIn: 900 } };
  }
}
