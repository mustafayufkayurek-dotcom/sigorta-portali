import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Request,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { FileValidationPipe } from '@/common/pipes/file-validation.pipe';
import { FileDocumentsService } from './file-documents.service';
import { CreateFileDocumentDto, SendWhatsappDto } from './dto/file-documents.dto';
import { StorageService } from '@/modules/storage/storage.service';

@UseGuards(JwtAuthGuard)
@Controller('file-documents')
export class FileDocumentsController {
  constructor(
    private readonly service: FileDocumentsService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  create(@Body() dto: CreateFileDocumentDto, @Request() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Get('entity/:entityType/:entityId')
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.service.findByEntity(entityType, entityId);
  }

  @Get('claim-file/:claimFileId/closure-conditions')
  checkClaimClosure(@Param('claimFileId') claimFileId: string) {
    return this.service.checkClaimFileClosureConditions(claimFileId);
  }

  @Get('emergency-case/:emergencyCaseId/closure-conditions')
  checkEmergencyClosure(@Param('emergencyCaseId') emergencyCaseId: string) {
    return this.service.checkEmergencyCaseClosureConditions(emergencyCaseId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/whatsapp')
  sendWhatsapp(@Param('id') id: string, @Body() dto: SendWhatsappDto) {
    return this.service.sendWhatsapp(id, dto);
  }

  @Post(':id/physical-upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhysical(
    @Param('id') id: string,
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File,
    @Request() req: any,
  ) {
    const result = await this.storage.upload(
      file.buffer,
      `file-documents/${id}/${file.originalname}`,
      file.mimetype,
    );
    return this.service.uploadPhysical(id, result.key, req.user.id);
  }
}
