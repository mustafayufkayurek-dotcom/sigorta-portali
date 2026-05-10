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
  create(@Body() dto: CreateInvoiceRequestDto, @Request() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Get()
  findAll(@Query('status') status?: string, @Query('serviceType') serviceType?: string) {
    return this.service.findAll(status, serviceType);
  }

  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboardSummary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceRequestStatusDto,
    @Request() req: any,
  ) {
    return this.service.updateStatus(id, dto, req.user.id);
  }

  @Get('claim-file/:claimFileId')
  findByClaimFile(@Param('claimFileId') claimFileId: string) {
    return this.service.findByClaimFile(claimFileId);
  }

  @Get('emergency-case/:emergencyCaseId')
  findByEmergencyCase(@Param('emergencyCaseId') emergencyCaseId: string) {
    return this.service.findByEmergencyCase(emergencyCaseId);
  }
}
