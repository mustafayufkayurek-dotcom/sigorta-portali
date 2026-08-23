import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe, RECEIPT_IMAGE_VALIDATION_PIPE } from '@/common/pipes/file-validation.pipe';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './dto/expenses.dto';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ClaimFilesService } from '@/modules/claim-files/claim-files.service';
import {
  isInsuranceCompanyUser,
  normalizeRequestUser,
} from '@/common/helpers/claim-file-scope.helper';

@Controller('expenses')
@UseGuards(PermissionsGuard)
export class ExpensesController {
  constructor(
    private readonly service: ExpensesService,
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
  async findAll(@Query() query: ExpenseFilterDto, @CurrentUser() user: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    if (requestingUser && isInsuranceCompanyUser(requestingUser.roleCode) && !insuranceCompanyIds?.length) {
      return { data: [], total: 0, page: 1, limit: Number(query.limit) || 50 };
    }
    return this.service.findAll(query, requestingUser, insuranceCompanyIds);
  }

  @Get('eligible-files')
  async getEligibleFiles(@Query('search') search?: string) {
    const data = await this.service.getEligibleFiles(search);
    return { data };
  }

  @Get('file-lookup')
  async lookupFile(@Query('q') q?: string) {
    const data = await this.service.lookupFileForExpense(q ?? '');
    return { data };
  }

  @Get('browse-files')
  async browseFiles(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('segment') segment?: 'hasar' | 'ozel_musteri',
  ) {
    return this.service.browseFilesForExpensePicker({
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      segment,
    });
  }

  @Get('work-group-audit')
  async workGroupAudit(@Query('fileCaseId') fileCaseId?: string, @CurrentUser() user: any) {
    if (!fileCaseId?.trim()) throw new BadRequestException('Dosya seçimi zorunludur');
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    return this.service.getWorkGroupExpenseAudit(fileCaseId.trim(), requestingUser, insuranceCompanyIds);
  }

  @Get('budget-tracking')
  async getBudgetTracking(@Query() query: ExpenseFilterDto, @CurrentUser() user: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    return this.service.getBudgetTracking(query, requestingUser, insuranceCompanyIds);
  }

  @Get('summary')
  async getSummary(@Query('year') year?: string, @Query('month') month?: string) {
    return this.service.getSummary(
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }

  @Post('upload-receipt')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(@UploadedFile(new FileValidationPipe()) file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Dosya bulunamadı');
    const url = await this.service.uploadReceipt(file);
    return { url };
  }

  @Post('scan-receipt')
  @UseInterceptors(FileInterceptor('file'))
  async scanReceipt(@UploadedFile(RECEIPT_IMAGE_VALIDATION_PIPE) file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fiş görseli bulunamadı');
    return this.service.scanReceipt(file);
  }

  @Post()
  async create(@Body() dto: CreateExpenseDto, @Request() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Put('bulk-approve')
  async bulkApprove(@Body() body: { ids: string[] }, @Request() req: any) {
    const roleCode = req.user?.roleCode?.toUpperCase();
    if (roleCode !== 'ADMIN' && roleCode !== 'MANAGER') {
      throw new BadRequestException('Bu işlem için yetkiniz yok');
    }
    return this.service.bulkApprove(body.ids, req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    return this.service.findOne(id, requestingUser, insuranceCompanyIds);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @Request() req: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(req.user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.update(id, dto, req.user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const { requestingUser, insuranceCompanyIds } = await this.resolveScope(user);
    await this.service.findOne(id, requestingUser, insuranceCompanyIds);
    return this.service.remove(id);
  }

  @Put(':id/approve')
  async approve(@Param('id') id: string, @Request() req: any) {
    const roleCode = req.user?.roleCode?.toUpperCase();
    if (roleCode !== 'ADMIN' && roleCode !== 'MANAGER') {
      throw new BadRequestException('Bu işlem için yetkiniz yok');
    }
    return this.service.approve(id, req.user.id);
  }

  @Put(':id/reject')
  async reject(@Param('id') id: string, @Request() req: any) {
    const roleCode = req.user?.roleCode?.toUpperCase();
    if (roleCode !== 'ADMIN' && roleCode !== 'MANAGER') {
      throw new BadRequestException('Bu işlem için yetkiniz yok');
    }
    return this.service.reject(id, req.user.id);
  }
}
