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
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { EntityDocumentsService } from './entity-documents.service';
import { FileValidationPipe } from '@/common/pipes/file-validation.pipe';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { ClaimFilesService } from '@/modules/claim-files/claim-files.service';
import {
  isInsuranceCompanyUser,
  normalizeRequestUser,
} from '@/common/helpers/claim-file-scope.helper';

@Controller('entity-documents')
@UseGuards(PermissionsGuard)
export class EntityDocumentsController {
  constructor(
    private readonly service: EntityDocumentsService,
    private readonly claimFilesService: ClaimFilesService,
  ) {}

  private async resolveScope(user: any) {
    const requestingUser = normalizeRequestUser(user);
    let insuranceCompanyIds: string[] | undefined;
    if (requestingUser && isInsuranceCompanyUser(requestingUser.roleCode)) {
      insuranceCompanyIds = await this.claimFilesService.getInsuranceScopes(requestingUser.id);
    }
    return { requestingUser, insuranceCompanyIds };
  }

  @Get()
  async findByEntity(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @CurrentUser() user: any,
  ) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    return this.service.findByEntity(entityType, entityId, requestingUser, insuranceCompanyIds);
  }

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
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    return this.service.create({
      file,
      entityType,
      entityId,
      documentTypeId: documentTypeId || undefined,
      notes: notes || undefined,
      uploadedByUserId: user.id,
      requestingUser,
      insuranceCompanyIds,
    });
  }

  @Get(':id/file')
  async streamFile(
    @Param('id') id: string,
    @Query('variant') variant: string | undefined,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    const { buffer, fileName, mimeType } = await this.service.getFileBuffer(
      id,
      requestingUser,
      insuranceCompanyIds,
      variant === 'thumb',
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(buffer);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response, @CurrentUser() user: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    const { buffer, fileName, mimeType } = await this.service.getFileBuffer(
      id,
      requestingUser,
      insuranceCompanyIds,
      false,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(buffer);
  }

  @Get(':id/signed-url')
  async getSignedUrl(@Param('id') id: string, @CurrentUser() user: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    const { url, fileName, mimeType } = await this.service.getSignedUrl(
      id,
      900,
      requestingUser,
      insuranceCompanyIds,
    );
    return { success: true, data: { url, fileName, mimeType, expiresIn: 900 } };
  }

  @Get(':id/thumbnail')
  async getThumbnail(@Param('id') id: string, @CurrentUser() user: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    const { url } = await this.service.getThumbnailSignedUrl(
      id,
      900,
      requestingUser,
      insuranceCompanyIds,
    );
    return { success: true, data: { url, expiresIn: 900 } };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    return this.service.remove(id, requestingUser, insuranceCompanyIds);
  }
}
