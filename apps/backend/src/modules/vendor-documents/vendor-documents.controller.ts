import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { VendorDocumentsService } from './vendor-documents.service';
import { FileValidationPipe } from '@/common/pipes/file-validation.pipe';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@Controller()
@UseGuards(PermissionsGuard)
export class VendorDocumentsController {
  constructor(private readonly service: VendorDocumentsService) {}

  @Get('vendors/:id/documents')
  @RequirePermissions('vendor.view')
  async findByVendor(@Param('id') id: string) {
    return this.service.findByVendor(id);
  }

  @Post('vendors/:id/documents')
  @RequirePermissions('vendor.update', 'document.upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async upload(
    @Param('id') vendorId: string,
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File,
    @Body('documentTypeId') documentTypeId: string,
    @Body('customLabel') customLabel: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.create(vendorId, file, documentTypeId, user.id, customLabel);
  }

  @Get('vendor-documents/:id/file')
  @RequirePermissions('vendor.view', 'document.view')
  async streamFile(
    @Param('id') id: string,
    @Query('variant') variant: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, fileName, mimeType } = await this.service.getFileBuffer(id, variant === 'thumb');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(buffer);
  }

  @Get('vendor-documents/:id/download')
  @RequirePermissions('vendor.view', 'document.view')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { buffer, fileName, mimeType } = await this.service.getFileBuffer(id, false);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(buffer);
  }

  // Signed URL döndür (frontend için)
  @Get('vendor-documents/:id/signed-url')
  @RequirePermissions('vendor.view', 'document.view')
  async getSignedUrl(@Param('id') id: string) {
    const { url, fileName, mimeType } = await this.service.getSignedUrl(id, 900);
    return { success: true, data: { url, fileName, mimeType, expiresIn: 900 } };
  }

  // Thumbnail signed URL
  @Get('vendor-documents/:id/thumbnail')
  @RequirePermissions('vendor.view', 'document.view')
  async getThumbnail(@Param('id') id: string) {
    const { url } = await this.service.getThumbnailSignedUrl(id, 900);
    return { success: true, data: { url, expiresIn: 900 } };
  }

  @Delete('vendor-documents/:id')
  @RequirePermissions('vendor.update', 'document.delete')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
