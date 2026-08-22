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
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SurveysService } from './surveys.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { OwnerExplanationDto } from './dto/owner-explanation.dto';

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

  @Get('claim-file/:claimFileId')
  async findByClaimFile(@Param('claimFileId') claimFileId: string) {
    return { data: await this.svc.findByClaimFile(claimFileId) };
  }

  @Get('emergency-case/:emergencyCaseId')
  async findByEmergencyCase(@Param('emergencyCaseId') emergencyCaseId: string) {
    return { data: await this.svc.findByEmergencyCase(emergencyCaseId) };
  }

  @Get('closure-unsent')
  async listClosureUnsent(@CurrentUser() user: { id?: string } | undefined) {
    return { data: await this.svc.listClosureUnsent(user?.id ?? '') };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.svc.findOne(id) };
  }

  @Post()
  async create(@Body() dto: CreateCampaignDto) {
    return { data: await this.svc.createCampaign(dto) };
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

  @Post('send-by-claim-file/:claimFileId')
  async createAndSendByClaimFile(
    @Param('claimFileId') claimFileId: string,
    @Body() body: { insuredPhone?: string },
  ) {
    const campaign = await this.svc.createCampaign({
      claimFileId,
      insuredPhone: body.insuredPhone,
    });
    const result = await this.svc.sendSurveyLink(campaign.id);
    return { data: result };
  }

  @Post('send-by-emergency-case/:emergencyCaseId')
  async createAndSendByEmergencyCase(
    @Param('emergencyCaseId') emergencyCaseId: string,
    @Body() body: { insuredPhone?: string },
  ) {
    const campaign = await this.svc.createCampaign({
      emergencyCaseId,
      insuredPhone: body.insuredPhone,
    });
    const result = await this.svc.sendSurveyLink(campaign.id);
    return { data: result };
  }

  @Post(':id/send')
  async sendLink(@Param('id') id: string) {
    return { data: await this.svc.sendSurveyLink(id) };
  }

  @Post(':id/owner-explanation')
  async saveOwnerExplanation(@Param('id') id: string, @Body() dto: OwnerExplanationDto) {
    return { data: await this.svc.saveOwnerExplanation(id, dto.ownerExplanation) };
  }
}
