import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { SmsService } from './sms.service';
import { MessageTemplateService } from './message-template.service';
import { UpdateMessageTemplateDto, TestSmsDto } from './dto/sms-settings.dto';

@Controller('notifications/sms')
export class SmsSettingsController {
  constructor(
    private readonly smsService: SmsService,
    private readonly templateService: MessageTemplateService,
  ) {}

  /** Tüm şablonları listele */
  @Get('templates')
  getTemplates() {
    return this.templateService.getAll();
  }

  /** Belirli bir şablonu getir */
  @Get('templates/:type')
  getTemplate(@Param('type') type: string) {
    return this.templateService.getByType(type);
  }

  /** Şablon güncelle */
  @Patch('templates/:type')
  updateTemplate(@Param('type') type: string, @Body() dto: UpdateMessageTemplateDto) {
    return this.templateService.update(type, dto);
  }

  /** Son SMS loglarını getir */
  @Get('logs')
  getLogs(@Query('limit') limit?: string) {
    return this.smsService.getLogs(limit ? parseInt(limit, 10) : 50);
  }

  /** Test SMS gönder */
  @Post('test')
  sendTest(@Body() dto: TestSmsDto) {
    const message = dto.message ?? 'Test SMS mesajı - Sigorta Hasar Sistemi';
    return this.smsService.sendTestSms(dto.to, message);
  }
}
