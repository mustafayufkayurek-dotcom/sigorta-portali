import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Request,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { InvoiceRequestsService } from './invoice-requests.service';
import {
  CreateInvoiceRequestDto,
  UpdateInvoiceRequestStatusDto,
} from './dto/invoice-requests.dto';

@UseGuards(JwtAuthGuard)
@Controller('invoice-requests')
export class InvoiceRequestsController {
  constructor(private readonly service: InvoiceRequestsService) {}

  @Post()
  async create(@Body() dto: CreateInvoiceRequestDto, @Request() req: any) {
    const data = await this.service.create(dto, req.user.id);
    return { success: true, data };
  }

  @Get()
  async findAll(@Query('status') status?: string, @Query('serviceType') serviceType?: string) {
    const data = await this.service.findAll(status, serviceType);
    return { success: true, data };
  }

  @Get('dashboard')
  async getDashboard() {
    const data = await this.service.getDashboardSummary();
    return { success: true, data };
  }

  @Get('claim-file/:claimFileId')
  async findByClaimFile(@Param('claimFileId') claimFileId: string) {
    const data = await this.service.findByClaimFile(claimFileId);
    return { success: true, data };
  }

  @Get('emergency-case/:emergencyCaseId')
  async findByEmergencyCase(@Param('emergencyCaseId') emergencyCaseId: string) {
    const data = await this.service.findByEmergencyCase(emergencyCaseId);
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { success: true, data };
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceRequestStatusDto,
    @Request() req: any,
  ) {
    const data = await this.service.updateStatus(id, dto, req.user.id);
    return { success: true, data };
  }
}
