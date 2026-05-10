import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './dto/expenses.dto';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExpensesService {
  private minioClient: Minio.Client | null = null;
  private minioBucket: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {
    this.minioBucket = this.config.get<string>('MINIO_BUCKET', '') || this.config.get<string>('S3_BUCKET', 'uploads');
    try {
      const endpoint = this.config.get<string>('MINIO_ENDPOINT', '') || this.config.get<string>('S3_ENDPOINT', '');
      if (endpoint) {
        const url = new URL(endpoint.startsWith('http') ? endpoint : `http://${endpoint}`);
        this.minioClient = new Minio.Client({
          endPoint: url.hostname,
          port: parseInt(url.port || '9000', 10),
          useSSL: url.protocol === 'https:',
          accessKey: this.config.get<string>('MINIO_ACCESS_KEY', '') || this.config.get<string>('S3_ACCESS_KEY', ''),
          secretKey: this.config.get<string>('MINIO_SECRET_KEY', '') || this.config.get<string>('S3_SECRET_KEY', ''),
        });
      }
    } catch (e) {
      // MinIO not configured
    }
  }

  async findAll(filters: ExpenseFilterDto) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.date.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }
    if (filters.expenseGroup) where.expenseGroup = filters.expenseGroup;
    if (filters.approvalStatus) where.approvalStatus = filters.approvalStatus;
    if (filters.operationSubject) where.operationSubject = filters.operationSubject;

    const [total, data] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          fileCase: { select: { id: true, fileNo: true } },
        },
      }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        fileCase: { select: { id: true, fileNo: true } },
      },
    });
    if (!expense) throw new NotFoundException('Masraf bulunamadı');
    return expense;
  }

  async create(dto: CreateExpenseDto, userId: string) {
    if (!dto.date || !dto.amount || !dto.expenseGroup || !dto.expenseSubgroup) {
      throw new BadRequestException('Tarih, tutar, masraf grubu ve alt grup zorunludur');
    }
    const date = new Date(dto.date);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
    const weekNumber = Math.ceil((dayOfYear + 1) / 7);

    const created = await this.prisma.expense.create({
      data: {
        date,
        amount: dto.amount,
        vatRate: dto.vatRate ?? 20,
        vatIncluded: dto.vatIncluded ?? true,
        description: dto.description,
        expenseGroup: dto.expenseGroup as any,
        expenseSubgroup: dto.expenseSubgroup,
        expensePlan: dto.expensePlan as any ?? null,
        operationSubject: dto.operationSubject as any ?? null,
        fileCaseId: dto.fileCaseId ?? null,
        receiptImageUrl: dto.receiptImageUrl ?? null,
        createdById: userId,
        weekNumber: dto.weekNumber ?? weekNumber,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    this.auditLogsService.log({
      entityType: 'Expense',
      entityId: created.id,
      action: 'CREATE',
      newValue: created,
      userId,
    });
    return created;
  }

  async update(id: string, dto: UpdateExpenseDto, _userId: string) {
    const previous = await this.findOne(id);
    const data: any = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    if (dto.expenseGroup) data.expenseGroup = dto.expenseGroup as any;
    if (dto.expensePlan !== undefined) data.expensePlan = dto.expensePlan as any ?? null;
    if (dto.operationSubject !== undefined) data.operationSubject = dto.operationSubject as any ?? null;
    const updated = await this.prisma.expense.update({ where: { id }, data });
    this.auditLogsService.log({
      entityType: 'Expense',
      entityId: id,
      action: 'UPDATE',
      oldValue: previous,
      newValue: updated,
      userId: _userId,
    });
    return updated;
  }

  async remove(id: string) {
    const previous = await this.findOne(id);
    await this.prisma.expense.delete({ where: { id } });
    this.auditLogsService.log({
      entityType: 'Expense',
      entityId: id,
      action: 'DELETE',
      oldValue: previous,
      userId: previous.createdById,
    });
    return { success: true };
  }

  async approve(id: string, userId: string) {
    await this.findOne(id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  async reject(id: string, userId: string) {
    await this.findOne(id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  async bulkApprove(ids: string[], userId: string) {
    await this.prisma.expense.updateMany({
      where: { id: { in: ids } },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
    return { success: true, count: ids.length };
  }

  async getSummary(year?: number, month?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);

    const expenses = await this.prisma.expense.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      select: {
        amount: true,
        expenseGroup: true,
        approvalStatus: true,
      },
    });

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byGroup: Record<string, number> = {};
    for (const e of expenses) {
      byGroup[e.expenseGroup] = (byGroup[e.expenseGroup] ?? 0) + Number(e.amount);
    }

    const pending = expenses.filter(e => e.approvalStatus === 'PENDING').length;
    const approved = expenses.filter(e => e.approvalStatus === 'APPROVED').reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      year: y,
      month: m,
      total,
      approved,
      pending,
      byGroup,
    };
  }

  async uploadReceipt(file: Express.Multer.File): Promise<string> {
    if (!this.minioClient) {
      throw new BadRequestException('MinIO yapılandırılmamış');
    }
    const ext = file.originalname.split('.').pop() || 'jpg';
    const key = `receipts/${uuidv4()}.${ext}`;
    await this.minioClient.putObject(
      this.minioBucket,
      key,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );
    const endpointUrl = this.config.get<string>('MINIO_PUBLIC_URL', this.config.get<string>('MINIO_ENDPOINT', ''));
    return `${endpointUrl}/${this.minioBucket}/${key}`;
  }
}
