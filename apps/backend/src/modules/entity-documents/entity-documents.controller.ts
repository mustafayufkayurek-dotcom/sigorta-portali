import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { EntityDocumentsService } from './entity-documents.service';
import { FileValidationPipe } from '@/common/pipes/file-validation.pipe';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('entity-documents')
export class EntityDocumentsController {
  constructor(private readonly service: EntityDocumentsService) {}

  // List docs for entity: GET /entity-documents?entityType=customer&entityId=xxx
  @Get()
  async findByEntity(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.service.findByEntity(entityType, entityId);
  }

  // Upload: POST /entity-documents
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File,
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: string,
    @Body('documentTypeId') documentTypeId: string,
    @Body('notes') notes: string,
    @CurrentUser() user: any,
  ) {
    return this.service.create({
      file,
      entityType,
      entityId,
      documentTypeId: documentTypeId || undefined,
      notes: notes || undefined,
      uploadedByUserId: user.id,
    });
  }

  // Signed URL ile güvenli erişim: GET /entity-documents/:id/download
  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { url, fileName, mimeType } = await this.service.getSignedUrl(id, 900);
    // Local provider'da direkt redirect, S3'te signed URL redirect
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    return res.redirect(302, url);
  }

  // Signed URL döndür (frontend için): GET /entity-documents/:id/signed-url
  @Get(':id/signed-url')
  async getSignedUrl(@Param('id') id: string) {
    const { url, fileName, mimeType } = await this.service.getSignedUrl(id, 900);
    return { success: true, data: { url, fileName, mimeType, expiresIn: 900 } };
  }

  // Thumbnail signed URL: GET /entity-documents/:id/thumbnail
  @Get(':id/thumbnail')
  async getThumbnail(@Param('id') id: string) {
    const { url } = await this.service.getThumbnailSignedUrl(id, 900);
    return { success: true, data: { url, expiresIn: 900 } };
  }

  // Delete: DELETE /entity-documents/:id
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
