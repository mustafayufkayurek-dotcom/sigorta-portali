import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { CreateFieldSurveyBriefDto } from './dto/create-field-survey-brief.dto';
import { FieldSurveyBriefsService } from './field-survey-briefs.service';

@ApiTags('field-survey-briefs')
@ApiBearerAuth()
@Controller('claim-files/:claimFileId/field-survey-briefs')
@UseGuards(PermissionsGuard)
export class FieldSurveyBriefsController {
  constructor(private readonly service: FieldSurveyBriefsService) {}

  @Post('scan')
  @RequirePermissions('claim_file.update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Keşif fotoğrafından tahmini ölçü çıkar (AI vision)' })
  async scan(
    @Param('claimFileId') claimFileId: string,
    @UploadedFile(RECEIPT_IMAGE_VALIDATION_PIPE) file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Keşif fotoğrafı bulunamadı');
    const data = await this.service.scanPhoto(claimFileId, file);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('claim_file.update')
  @ApiOperation({ summary: 'Keşif ölçüsü kaydet' })
  async create(
    @Param('claimFileId') claimFileId: string,
    @Body() dto: CreateFieldSurveyBriefDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.service.create(claimFileId, user.id, dto);
    return { success: true, data };
  }

  @Get()
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Dosyaya ait keşif ölçülerini listele' })
  async list(@Param('claimFileId') claimFileId: string) {
    const data = await this.service.listByClaimFile(claimFileId);
    return { success: true, data };
  }

  @Get(':id/pdf')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'Keşif ölçüsü PDF indir' })
  async pdf(
    @Param('claimFileId') claimFileId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.generatePdf(claimFileId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get(':id/share')
  @RequirePermissions('claim_file.view')
  @ApiOperation({ summary: 'WhatsApp ve PDF paylaşım bağlantıları' })
  async share(
    @Param('claimFileId') claimFileId: string,
    @Param('id') id: string,
    @Query('phone') phone?: string,
  ) {
    const data = await this.service.getSharePayload(claimFileId, id, phone);
    return { success: true, data };
  }
}
