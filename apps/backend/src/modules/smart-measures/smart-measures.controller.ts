import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RECEIPT_IMAGE_VALIDATION_PIPE } from '@/common/pipes/file-validation.pipe';
import { CreateSmartMeasureDto } from './dto/create-smart-measure.dto';
import { CreateSmartMeasureVersionDto } from './dto/create-smart-measure-version.dto';
import { UpdateSmartMeasureStatusDto } from './dto/update-smart-measure-status.dto';
import { SmartMeasuresService } from './smart-measures.service';

function toContentDispositionAttachment(filename: string): string {
  const ascii =
    filename
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[şŞ]/g, 's')
      .replace(/[ıİ]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .replace(/[^\x20-\x7E]+/g, '_')
      .replace(/["\\]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || 'akilli-olcum.pdf';
  const utf8 = encodeURIComponent(filename).replace(/['()]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

type AuthUser = { id: string; email?: string | null; roleCode?: string; role?: { code?: string } };

function toRequestUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    roleCode: user.roleCode ?? user.role?.code,
  };
}

@ApiTags('smart-measures')
@ApiBearerAuth()
@Controller('claim-files/:claimFileId/smart-measures')
@UseGuards(PermissionsGuard)
export class SmartMeasuresController {
  constructor(private readonly service: SmartMeasuresService) {}

  @Post('photo')
  @RequirePermissions('claim_file.update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Akıllı ölçüm fotoğrafı → FileAsset + ClaimDocument' })
  async uploadPhoto(
    @Param('claimFileId') claimFileId: string,
    @UploadedFile(RECEIPT_IMAGE_VALIDATION_PIPE) file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Ölçüm fotoğrafı bulunamadı');
    const data = await this.service.uploadPhoto(claimFileId, toRequestUser(user), file);
    return { success: true, data };
  }

  @Post('detect')
  @RequirePermissions('claim_file.update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Fotoğraftan AI nesne tipi + güven skoru öner' })
  async detect(
    @Param('claimFileId') claimFileId: string,
    @UploadedFile(RECEIPT_IMAGE_VALIDATION_PIPE) file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Ölçüm fotoğrafı bulunamadı');
    const data = await this.service.detectFromPhoto(claimFileId, toRequestUser(user), file);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Akıllı ölçüm elemanı + ilk sürüm (mm)' })
  async create(
    @Param('claimFileId') claimFileId: string,
    @Body() dto: CreateSmartMeasureDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.create(claimFileId, toRequestUser(user), dto);
    return { success: true, data };
  }

  @Get()
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Dosyadaki akıllı ölçümleri listele' })
  async list(@Param('claimFileId') claimFileId: string, @CurrentUser() user: AuthUser) {
    const data = await this.service.listByClaimFile(claimFileId, toRequestUser(user));
    return { success: true, data };
  }

  @Get(':elementId/pdf')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Akıllı ölçüm PDF indir' })
  async pdf(
    @Param('claimFileId') claimFileId: string,
    @Param('elementId') elementId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.generatePdf(
      claimFileId,
      elementId,
      toRequestUser(user),
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': toContentDispositionAttachment(filename),
    });
    res.send(buffer);
  }

  @Get(':elementId')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Akıllı ölçüm detayı + sürüm geçmişi' })
  async getOne(
    @Param('claimFileId') claimFileId: string,
    @Param('elementId') elementId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.getById(claimFileId, elementId, toRequestUser(user));
    return { success: true, data };
  }

  @Post(':elementId/versions')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Yeni ölçüm sürümü (eski silinmez)' })
  async addVersion(
    @Param('claimFileId') claimFileId: string,
    @Param('elementId') elementId: string,
    @Body() dto: CreateSmartMeasureVersionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.addVersion(
      claimFileId,
      elementId,
      toRequestUser(user),
      dto,
    );
    return { success: true, data };
  }

  @Post(':elementId/status')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Eleman durum geçişi' })
  async updateStatus(
    @Param('claimFileId') claimFileId: string,
    @Param('elementId') elementId: string,
    @Body() dto: UpdateSmartMeasureStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.updateStatus(
      claimFileId,
      elementId,
      toRequestUser(user),
      dto.status,
    );
    return { success: true, data };
  }

  @Post(':elementId/archive')
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Soft archive (version silinmez)' })
  async archive(
    @Param('claimFileId') claimFileId: string,
    @Param('elementId') elementId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.archive(claimFileId, elementId, toRequestUser(user));
    return { success: true, data };
  }
}
