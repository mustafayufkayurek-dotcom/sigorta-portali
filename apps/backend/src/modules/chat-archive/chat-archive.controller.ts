import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ChatArchiveService } from './chat-archive.service';
import { FileValidationPipe } from '@/common/pipes/file-validation.pipe';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('chat-archives')
@ApiBearerAuth()
@Controller('chat-archives')
export class ChatArchiveController {
  constructor(private readonly chatArchiveService: ChatArchiveService) {}

  @Post('upload')
  @ApiOperation({ summary: 'WhatsApp .txt dosyası yükle ve parse et' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new FileValidationPipe({
        maxSize: 10 * 1024 * 1024,
        allowedMime: new Set(['text/plain', 'application/octet-stream']),
      }),
    )
    file: Express.Multer.File,
    @Body('claimFileId') claimFileId: string,
    @Body('label') label: string,
    @CurrentUser() user: any,
  ) {
    const rawContent = file.buffer.toString('utf-8');
    const data = await this.chatArchiveService.upload({
      claimFileId,
      label,
      rawContent,
      uploadedById: user.id,
    });
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: 'Hasar dosyasına ait yazışmaları listele' })
  async findAll(@Query('claimFileId') claimFileId: string) {
    const data = await this.chatArchiveService.findByClaimFile(claimFileId);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Yazışma detayı (mesajlar dahil)' })
  async findOne(@Param('id') id: string) {
    const data = await this.chatArchiveService.findOne(id);
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Yazışmayı sil' })
  async remove(@Param('id') id: string) {
    const data = await this.chatArchiveService.remove(id);
    return { success: true, data };
  }
}
