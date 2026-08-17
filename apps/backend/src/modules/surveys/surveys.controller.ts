import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { SurveysService } from './surveys.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@UseGuards(JwtAuthGuard)
@Controller('surveys')
export class SurveysController {
  constructor(private readonly svc: SurveysService) {}

  @Get()
  async findAll(@Query('insuranceCompanyId') insuranceCompanyId?: string) {
    return { data: await this.svc.findAll(insuranceCompanyId) };
  }

  @Get('invoice-request/:invoiceRequestId')
  async findByInvoiceRequest(@Param('invoiceRequestId') invoiceRequestId: string) {
    return { data: await this.svc.findByInvoiceRequest(invoiceRequestId) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.svc.findOne(id) };
  }

  @Post()
  async create(@Body() dto: CreateCampaignDto) {
    return { data: await this.svc.createCampaign(dto) };
  }

  @Post(':id/send')
  async sendLink(@Param('id') id: string) {
    return { data: await this.svc.sendSurveyLink(id) };
  }

  @Post('send-by-invoice-request/:invoiceRequestId')
  async createAndSend(
    @Param('invoiceRequestId') invoiceRequestId: string,
    @Body() body: { insuredPhone?: string },
  ) {
    const campaign = await this.svc.createCampaign({
      invoiceRequestId,
      insuredPhone: body.insuredPhone,
    });
    const result = await this.svc.sendSurveyLink(campaign.id);
    return { data: result };
  }
}
