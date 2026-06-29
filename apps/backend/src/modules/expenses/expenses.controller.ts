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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe, RECEIPT_IMAGE_VALIDATION_PIPE } from '@/common/pipes/file-validation.pipe';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './dto/expenses.dto';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get()
  async findAll(@Query() query: ExpenseFilterDto) {
    return this.service.findAll(query);
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

  @Get('budget-tracking')
  async getBudgetTracking(@Query() query: ExpenseFilterDto) {
    return this.service.getBudgetTracking(query);
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
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @Request() req: any) {
    return this.service.update(id, dto, req.user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
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
