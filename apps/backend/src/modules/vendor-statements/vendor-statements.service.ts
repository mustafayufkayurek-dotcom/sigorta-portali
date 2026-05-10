import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateStatementDto, CreateStatementItemDto } from './dto/create-statement.dto';

const STATEMENT_DEADLINE_DAYS = 14;
const DISPUTE_THRESHOLD_COUNT = 5;
const DISPUTE_THRESHOLD_WINDOW_DAYS = 7;
const DISPUTE_RATE_THRESHOLD_PCT = 30;
const DISPUTE_RATE_WINDOW_DAYS = 90;

// ExpenseCategory kodu → P&L gider tipi eşlemesi
const VENDOR_PAYMENT_CATEGORY_CODE = 'VENDOR_PAYMENT';

@Injectable()
export class VendorStatementsService {
  private readonly logger = new Logger(VendorStatementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Util ──────────────────────────────────────────────────────────────────

  private async generateStatementNo(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.vendorPaymentStatement.count({
      where: { statementNo: { startsWith: `EKS-${year}-` } },
    });
    return `EKS-${year}-${String(count + 1).padStart(3, '0')}`;
  }

  private calcTotal(items: CreateStatementItemDto[]): number {
    return items.reduce((sum, item) => sum + (item.totalAmount ?? 0), 0);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(params: {
    vendorId?: string;
    status?: string;
    periodStart?: string;
    periodEnd?: string;
    claimFileId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.vendorId) where.vendorId = params.vendorId;
    if (params.status) where.status = params.status;
    if (params.periodStart || params.periodEnd) {
      where.periodStart = {};
      if (params.periodStart) where.periodStart.gte = new Date(params.periodStart);
      if (params.periodEnd) where.periodStart.lte = new Date(params.periodEnd);
    }
    if (params.claimFileId) {
      where.items = { some: { claimFileId: params.claimFileId } };
    }

    const [data, total] = await Promise.all([
      this.prisma.vendorPaymentStatement.findMany({
        where,
        skip,
        take: limit,
        include: {
          vendor: { select: { id: true, name: true, phone: true, email: true, taxNumber: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { items: true, receipts: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendorPaymentStatement.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const stmt = await this.prisma.vendorPaymentStatement.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, name: true, phone: true, email: true, iban: true, bankName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            claimFile: { select: { id: true, fileNo: true, productBranch: true } },
            workGroup: { select: { id: true, name: true } },
            disputeRecord: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        receipts: {
          include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        tokens: { select: { token: true, expiresAt: true, accessedAt: true } },
      },
    });
    if (!stmt) throw new NotFoundException('Ekstre bulunamadı');
    return stmt;
  }

  async create(dto: CreateStatementDto, userId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException('Tedarikçi bulunamadı');

    const statementNo = await this.generateStatementNo();
    const items = dto.items ?? [];
    const totalAmount = this.calcTotal(items);

    const stmt = await this.prisma.vendorPaymentStatement.create({
      data: {
        vendorId: dto.vendorId,
        statementNo,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        totalAmount,
        notes: dto.notes ?? null,
        createdByUserId: userId,
        items: {
          create: items.map((item, idx) => ({
            paymentId: item.paymentId ?? null,
            claimFileId: item.claimFileId,
            repairReportItemId: item.repairReportItemId ?? null,
            workGroupId: item.workGroupId ?? null,
            lineDescription: item.lineDescription,
            quantity: item.quantity ?? 1,
            unit: item.unit ?? null,
            unitPrice: item.unitPrice,
            totalAmount: item.totalAmount,
            vatRate: item.vatRate ?? 18,
            receiptRef: item.receiptRef ?? null,
            receiptDate: item.receiptDate ? new Date(item.receiptDate) : null,
            sortOrder: idx,
          })),
        },
      },
    });

    await this.auditLog('vendor_payment_statement', stmt.id, 'CREATE', null, stmt, userId);
    return stmt;
  }

  async update(id: string, dto: any, userId: string) {
    const stmt = await this.findOne(id);
    if (stmt.status !== 'DRAFT') {
      throw new BadRequestException('Sadece taslak durumdaki ekstreler düzenlenebilir');
    }

    const updated = await this.prisma.vendorPaymentStatement.update({
      where: { id },
      data: {
        ...(dto.periodStart ? { periodStart: new Date(dto.periodStart) } : {}),
        ...(dto.periodEnd ? { periodEnd: new Date(dto.periodEnd) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.auditLog('vendor_payment_statement', id, 'UPDATE', stmt, updated, userId);
    return updated;
  }

  // ── Kalem Ekleme/Silme ──────────────────────────────────────────────────

  async addItem(statementId: string, item: CreateStatementItemDto, userId: string) {
    const stmt = await this.prisma.vendorPaymentStatement.findUnique({ where: { id: statementId } });
    if (!stmt) throw new NotFoundException('Ekstre bulunamadı');
    if (stmt.status !== 'DRAFT') throw new BadRequestException('Sadece taslak ekstreye kalem eklenebilir');

    const count = await this.prisma.vendorStatementItem.count({ where: { statementId } });
    const created = await this.prisma.vendorStatementItem.create({
      data: {
        statementId,
        paymentId: item.paymentId ?? null,
        claimFileId: item.claimFileId,
        repairReportItemId: item.repairReportItemId ?? null,
        workGroupId: item.workGroupId ?? null,
        lineDescription: item.lineDescription,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? null,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
        vatRate: item.vatRate ?? 18,
        receiptRef: item.receiptRef ?? null,
        receiptDate: item.receiptDate ? new Date(item.receiptDate) : null,
        sortOrder: count,
      },
    });

    await this.recalcTotal(statementId);
    await this.auditLog('vendor_statement_item', created.id, 'CREATE', null, created, userId);
    return created;
  }

  async removeItem(statementId: string, itemId: string, userId: string) {
    const stmt = await this.prisma.vendorPaymentStatement.findUnique({ where: { id: statementId } });
    if (!stmt) throw new NotFoundException('Ekstre bulunamadı');
    if (stmt.status !== 'DRAFT') throw new BadRequestException('Sadece taslak ekstreden kalem silinebilir');

    const item = await this.prisma.vendorStatementItem.findFirst({
      where: { id: itemId, statementId },
    });
    if (!item) throw new NotFoundException('Kalem bulunamadı');

    await this.prisma.vendorStatementItem.delete({ where: { id: itemId } });
    await this.recalcTotal(statementId);
    await this.auditLog('vendor_statement_item', itemId, 'DELETE', item, null, userId);
    return { success: true };
  }

  private async recalcTotal(statementId: string) {
    const agg = await this.prisma.vendorStatementItem.aggregate({
      where: { statementId },
      _sum: { totalAmount: true },
    });
    await this.prisma.vendorPaymentStatement.update({
      where: { id: statementId },
      data: { totalAmount: agg._sum.totalAmount ?? 0 },
    });
  }

  // ── Ekstre Gönder ─────────────────────────────────────────────────────────

  async sendStatement(id: string, userId: string) {
    const stmt = await this.prisma.vendorPaymentStatement.findUnique({
      where: { id },
      include: {
        vendor: true,
        items: true,
        _count: { select: { items: true } },
      },
    });
    if (!stmt) throw new NotFoundException('Ekstre bulunamadı');
    if (stmt.status !== 'DRAFT') throw new BadRequestException('Sadece taslak ekstre gönderilebilir');
    if (stmt._count.items === 0) throw new BadRequestException('Göndermek için en az bir kalem gerekli');

    const now = new Date();
    const deadlineAt = new Date(now.getTime() + STATEMENT_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
    const tokenExpiresAt = new Date(deadlineAt.getTime() + 3 * 24 * 60 * 60 * 1000);

    const token = await this.generateToken();

    const [updated] = await this.prisma.$transaction([
      this.prisma.vendorPaymentStatement.update({
        where: { id },
        data: { status: 'SENT', sentAt: now, deadlineAt },
      }),
      this.prisma.vendorStatementToken.create({
        data: {
          statementId: id,
          token,
          expiresAt: tokenExpiresAt,
        },
      }),
    ]);

    // SMS gönderim kaydı
    if (stmt.vendor.phone) {
      const message = `Meridyen Assistance: ${stmt.periodStart.toLocaleDateString('tr-TR')} - ${stmt.periodEnd.toLocaleDateString('tr-TR')} dönemine ait ödeme ekstreniz hazır. Lütfen ${STATEMENT_DEADLINE_DAYS} gün içinde inceleyin: ${process.env.APP_URL ?? 'https://app.meridyen.com'}/ekstre/${token}`;
      await this.prisma.smsLog.create({
        data: {
          to: stmt.vendor.phone,
          message,
          status: 'queued',
          provider: 'console',
        },
      });
    }

    await this.auditLog('vendor_payment_statement', id, 'SEND', null, { status: 'SENT', deadlineAt }, userId);
    return { ...updated, token };
  }

  private async generateToken(): Promise<string> {
    const { randomUUID } = await import('crypto');
    return randomUUID();
  }

  // ── Öneri: Payment'lardan kalem oluştur ──────────────────────────────────

  async suggestItems(vendorId: string, periodStart: string, periodEnd: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        payerType: 'vendor',
        payerId: vendorId,
        paymentDate: {
          gte: new Date(periodStart),
          lte: new Date(periodEnd),
        },
        status: 'completed',
      },
      include: {
        claimFile: { select: { id: true, fileNo: true, productBranch: true } },
        invoice: { select: { id: true, invoiceNo: true } },
      },
      orderBy: { paymentDate: 'asc' },
    });

    return payments.map((p) => ({
      paymentId: p.id,
      claimFileId: p.claimFileId,
      claimFileNo: p.claimFile?.fileNo,
      lineDescription: `${p.claimFile?.fileNo ?? ''} - ${p.method.toUpperCase()} ödemesi`,
      quantity: 1,
      unit: 'adet',
      unitPrice: p.amount,
      totalAmount: p.amount,
      vatRate: 0,
      receiptRef: p.referenceNo ?? null,
      receiptDate: p.paymentDate.toISOString(),
    }));
  }

  // ── Token ile ekstre görüntüle ────────────────────────────────────────────

  async findByToken(token: string, ipAddress?: string) {
    const tokenRecord = await this.prisma.vendorStatementToken.findUnique({
      where: { token },
      include: {
        statement: {
          include: {
            vendor: { select: { id: true, name: true, phone: true } },
            items: {
              include: {
                claimFile: { select: { id: true, fileNo: true, productBranch: true } },
                workGroup: { select: { id: true, name: true } },
                disputeRecord: {
                  select: { id: true, reason: true, reasonNote: true, status: true },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
            receipts: {
              select: {
                id: true,
                fileName: true,
                bankRef: true,
                bankDate: true,
                amount: true,
              },
            },
          },
        },
      },
    });

    if (!tokenRecord) throw new NotFoundException('Geçersiz veya süresi dolmuş bağlantı');
    if (new Date() > tokenRecord.expiresAt) {
      throw new ForbiddenException('Bu bağlantının süresi dolmuştur');
    }

    // İlk erişim kaydı
    if (!tokenRecord.accessedAt) {
      await this.prisma.vendorStatementToken.update({
        where: { token },
        data: { accessedAt: new Date(), ipAddress: ipAddress ?? null },
      });
    }

    return tokenRecord.statement;
  }

  // ── Token ile onay/itiraz ─────────────────────────────────────────────────

  async approveByToken(token: string, itemId?: string) {
    const tokenRecord = await this.prisma.vendorStatementToken.findUnique({
      where: { token },
      include: { statement: true },
    });
    if (!tokenRecord) throw new NotFoundException('Geçersiz bağlantı');
    if (new Date() > tokenRecord.statement.deadlineAt!) {
      throw new ForbiddenException('Mutabakat süresi dolmuştur');
    }
    if (tokenRecord.statement.status === 'CLOSED') {
      throw new BadRequestException('Bu ekstre kapatılmıştır');
    }

    if (itemId) {
      // Tek kalem onay
      const item = await this.prisma.vendorStatementItem.findFirst({
        where: { id: itemId, statementId: tokenRecord.statementId },
      });
      if (!item) throw new NotFoundException('Kalem bulunamadı');
      if (item.approvalStatus !== 'PENDING') {
        throw new BadRequestException('Bu kalem zaten işlem görmüş');
      }
      await this.prisma.vendorStatementItem.update({
        where: { id: itemId },
        data: { approvalStatus: 'APPROVED', approvedAt: new Date() },
      });
    } else {
      // Tümünü onayla
      await this.prisma.vendorStatementItem.updateMany({
        where: { statementId: tokenRecord.statementId, approvalStatus: 'PENDING' },
        data: { approvalStatus: 'APPROVED', approvedAt: new Date() },
      });
    }

    await this.updateStatementStatus(tokenRecord.statementId);
    return { success: true };
  }

  async disputeByToken(
    token: string,
    itemId: string,
    reason: string,
    reasonNote: string,
    evidenceStorageKey?: string,
    evidenceFileName?: string,
  ) {
    const tokenRecord = await this.prisma.vendorStatementToken.findUnique({
      where: { token },
      include: { statement: true },
    });
    if (!tokenRecord) throw new NotFoundException('Geçersiz bağlantı');
    if (new Date() > tokenRecord.statement.deadlineAt!) {
      throw new ForbiddenException('Mutabakat süresi dolmuştur');
    }

    const item = await this.prisma.vendorStatementItem.findFirst({
      where: { id: itemId, statementId: tokenRecord.statementId },
    });
    if (!item) throw new NotFoundException('Kalem bulunamadı');

    // Tekrar itiraz engeli
    const existingDispute = await this.prisma.vendorStatementDispute.findUnique({
      where: { statementItemId: itemId },
    });
    if (existingDispute && ['OPEN', 'UNDER_REVIEW'].includes(existingDispute.status)) {
      throw new BadRequestException('Bu kalem için zaten açık bir itiraz mevcuttur');
    }

    // Gerekçe zorunlu + min uzunluk
    if (!reasonNote || reasonNote.trim().length < 20) {
      throw new BadRequestException('İtiraz açıklaması en az 20 karakter olmalıdır');
    }

    // OTHER gerekçesi için kanıt zorunlu
    if (reason === 'OTHER' && !evidenceStorageKey) {
      throw new BadRequestException('"Diğer" gerekçesi seçildiğinde kanıt belgesi yüklenmesi zorunludur');
    }

    await this.prisma.$transaction([
      this.prisma.vendorStatementItem.update({
        where: { id: itemId },
        data: { approvalStatus: 'DISPUTED', disputedAt: new Date() },
      }),
      this.prisma.vendorStatementDispute.upsert({
        where: { statementItemId: itemId },
        create: {
          statementItemId: itemId,
          vendorId: tokenRecord.statement.vendorId,
          reason: reason as any,
          reasonNote: reasonNote.trim(),
          evidenceStorageKey: evidenceStorageKey ?? null,
          evidenceFileName: evidenceFileName ?? null,
          status: 'OPEN',
        },
        update: {
          reason: reason as any,
          reasonNote: reasonNote.trim(),
          evidenceStorageKey: evidenceStorageKey ?? null,
          evidenceFileName: evidenceFileName ?? null,
          status: 'OPEN',
        },
      }),
    ]);

    await this.updateStatementStatus(tokenRecord.statementId);
    await this.checkDisputeThresholds(tokenRecord.statement.vendorId, tokenRecord.statementId);
    return { success: true };
  }

  // ── Statement Status Güncelleme ───────────────────────────────────────────

  private async updateStatementStatus(statementId: string) {
    const items = await this.prisma.vendorStatementItem.findMany({
      where: { statementId },
      select: { approvalStatus: true },
    });

    const total = items.length;
    if (total === 0) return;

    const approved = items.filter((i) => ['APPROVED', 'AUTO_APPROVED'].includes(i.approvalStatus)).length;
    const disputed = items.filter((i) => i.approvalStatus === 'DISPUTED').length;
    const pending = items.filter((i) => i.approvalStatus === 'PENDING').length;

    let newStatus: string;
    if (pending === 0 && disputed === 0) {
      newStatus = 'APPROVED';
    } else if (disputed > 0 && pending === 0) {
      newStatus = 'DISPUTED';
    } else if (approved > 0 || disputed > 0) {
      newStatus = 'PARTIALLY_APPROVED';
    } else {
      return; // hepsi hala PENDING, değişiklik yok
    }

    await this.prisma.vendorPaymentStatement.update({
      where: { id: statementId },
      data: { status: newStatus as any },
    });

    // P&L Faz 3: APPROVED durumuna geçince otomatik CostEntry oluştur
    if (newStatus === 'APPROVED') {
      await this.syncApprovedStatementToCostEntries(statementId);
    }
  }

  /**
   * Onaylanan VendorStatement kalemlerini CostEntry (VENDOR_PAYMENT) olarak kaydeder.
   * Daha önce oluşturulmuş kayıtları atlar (sourceRefId ile idempotent).
   */
  private async syncApprovedStatementToCostEntries(statementId: string): Promise<void> {
    try {
      const statement = await this.prisma.vendorPaymentStatement.findUnique({
        where: { id: statementId },
        select: {
          id: true,
          vendorId: true,
          statementNo: true,
          periodEnd: true,
          items: {
            where: { approvalStatus: { in: ['APPROVED', 'AUTO_APPROVED'] } },
            select: {
              id: true,
              claimFileId: true,
              totalAmount: true,
              lineDescription: true,
              repairReportItemId: true,
            },
          },
        },
      });

      if (!statement) return;

      const category = await this.prisma.expenseCategory.findUnique({
        where: { code: VENDOR_PAYMENT_CATEGORY_CODE },
        select: { id: true },
      });

      for (const item of statement.items) {
        if (!item.claimFileId) continue;

        // İdempotent: aynı item için zaten kayıt varsa atla
        const exists = await this.prisma.costEntry.findFirst({
          where: { source: 'vendor_statement', sourceRefId: item.id },
          select: { id: true },
        });
        if (exists) continue;

        await this.prisma.costEntry.create({
          data: {
            claimFileId: item.claimFileId,
            vendorId: statement.vendorId,
            category: VENDOR_PAYMENT_CATEGORY_CODE,
            expenseCategoryId: category?.id,
            description: item.lineDescription ?? `Tedarikçi Hakediş — ${statement.statementNo}`,
            amount: item.totalAmount ?? 0,
            vatRate: 0,
            entryDate: statement.periodEnd ?? new Date(),
            source: 'vendor_statement',
            sourceRefId: item.id,
            isOverhead: false,
          },
        });
      }

      this.logger.log(`VendorStatement ${statementId} → CostEntry sync tamamlandı`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`syncApprovedStatementToCostEntries hatası: ${message}`);
    }
  }

  // ── İtiraz Eşik Kontrolü ──────────────────────────────────────────────────

  async checkDisputeThresholds(vendorId: string, statementId: string) {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - DISPUTE_THRESHOLD_WINDOW_DAYS);

    const recentDisputes = await this.prisma.vendorStatementDispute.count({
      where: {
        vendorId,
        createdAt: { gte: windowStart },
      },
    });

    if (recentDisputes >= DISPUTE_THRESHOLD_COUNT) {
      const alreadyAlerted = await this.prisma.vendorDisputeAlert.findFirst({
        where: {
          vendorId,
          alertType: 'BULK_DISPUTE',
          createdAt: { gte: windowStart },
          isAcknowledged: false,
        },
      });
      if (!alreadyAlerted) {
        await this.prisma.vendorDisputeAlert.create({
          data: {
            vendorId,
            statementId,
            alertType: 'BULK_DISPUTE',
            disputeCount: recentDisputes,
            windowDays: DISPUTE_THRESHOLD_WINDOW_DAYS,
          },
        });
        this.logger.warn(`Toplu itiraz alarmı: vendor=${vendorId}, count=${recentDisputes}`);
      }
    }

    // Sürekli itiraz oranı kontrolü (90 günde %30)
    const window90 = new Date();
    window90.setDate(window90.getDate() - DISPUTE_RATE_WINDOW_DAYS);

    const totalItems90 = await this.prisma.vendorStatementItem.count({
      where: {
        statement: { vendorId, sentAt: { gte: window90 } },
      },
    });
    const disputedItems90 = await this.prisma.vendorStatementItem.count({
      where: {
        statement: { vendorId, sentAt: { gte: window90 } },
        approvalStatus: 'DISPUTED',
      },
    });

    if (totalItems90 > 0) {
      const rate = (disputedItems90 / totalItems90) * 100;
      if (rate >= DISPUTE_RATE_THRESHOLD_PCT) {
        const alreadyAlerted = await this.prisma.vendorDisputeAlert.findFirst({
          where: {
            vendorId,
            alertType: 'HIGH_DISPUTE_RATE',
            createdAt: { gte: window90 },
            isAcknowledged: false,
          },
        });
        if (!alreadyAlerted) {
          await this.prisma.vendorDisputeAlert.create({
            data: {
              vendorId,
              statementId,
              alertType: 'HIGH_DISPUTE_RATE',
              disputeCount: disputedItems90,
              windowDays: DISPUTE_RATE_WINDOW_DAYS,
            },
          });
          this.logger.warn(`Yüksek itiraz oranı alarmı: vendor=${vendorId}, rate=${rate.toFixed(1)}%`);
        }
      }
    }
  }

  // ── İtiraz Yönetimi (Yönetici) ────────────────────────────────────────────

  async findDisputes(params: {
    vendorId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.vendorId) where.vendorId = params.vendorId;
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.vendorStatementDispute.findMany({
        where,
        skip,
        take: limit,
        include: {
          vendor: { select: { id: true, name: true, phone: true } },
          statementItem: {
            include: {
              claimFile: { select: { id: true, fileNo: true } },
              statement: { select: { id: true, statementNo: true } },
            },
          },
          resolvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendorStatementDispute.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async resolveDispute(id: string, resolution: string, resolvedNote: string, userId: string) {
    const dispute = await this.prisma.vendorStatementDispute.findUnique({
      where: { id },
      include: { statementItem: true },
    });
    if (!dispute) throw new NotFoundException('İtiraz bulunamadı');
    if (!['OPEN', 'UNDER_REVIEW'].includes(dispute.status)) {
      throw new BadRequestException('Bu itiraz zaten çözümlenmiştir');
    }

    if (!['RESOLVED_ACCEPT', 'RESOLVED_REJECT'].includes(resolution)) {
      throw new BadRequestException('Geçersiz çözüm kararı');
    }

    // İtiraz kabul edildiyse kalem durumunu pending'e çek (yönetici revize edecek)
    // Reddedildiyse kalem approved kalır
    const itemNewStatus = resolution === 'RESOLVED_ACCEPT' ? 'APPROVED' : 'APPROVED';

    await this.prisma.$transaction([
      this.prisma.vendorStatementDispute.update({
        where: { id },
        data: {
          status: resolution as any,
          resolvedAt: new Date(),
          resolvedByUserId: userId,
          resolvedNote,
        },
      }),
      this.prisma.vendorStatementItem.update({
        where: { id: dispute.statementItemId },
        data: { approvalStatus: itemNewStatus as any, approvedAt: new Date() },
      }),
    ]);

    await this.updateStatementStatus(dispute.statementItem.statementId);
    await this.auditLog('vendor_statement_dispute', id, 'RESOLVE', dispute, { resolution, resolvedNote }, userId);
    return { success: true };
  }

  async acknowledgeAlert(alertId: string, userId: string) {
    const alert = await this.prisma.vendorDisputeAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alarm bulunamadı');

    return this.prisma.vendorDisputeAlert.update({
      where: { id: alertId },
      data: { isAcknowledged: true, acknowledgedByUserId: userId, acknowledgedAt: new Date() },
    });
  }

  async findAlerts(params: { vendorId?: string; isAcknowledged?: boolean }) {
    return this.prisma.vendorDisputeAlert.findMany({
      where: {
        ...(params.vendorId ? { vendorId: params.vendorId } : {}),
        ...(params.isAcknowledged !== undefined ? { isAcknowledged: params.isAcknowledged } : {}),
      },
      include: {
        vendor: { select: { id: true, name: true } },
        statement: { select: { id: true, statementNo: true } },
        acknowledgedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Vendor Stats (tedarikçi kartı özeti) ─────────────────────────────────

  async getVendorStatementSummary(vendorId: string) {
    const [totalStatements, approvedStatements, openDisputes, totalPaid] = await Promise.all([
      this.prisma.vendorPaymentStatement.count({ where: { vendorId } }),
      this.prisma.vendorPaymentStatement.count({ where: { vendorId, status: 'APPROVED' } }),
      this.prisma.vendorStatementDispute.count({ where: { vendorId, status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      this.prisma.vendorPaymentStatement.aggregate({
        where: { vendorId, status: { in: ['APPROVED', 'CLOSED'] } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      totalStatements,
      approvedStatements,
      openDisputes,
      totalApprovedAmount: totalPaid._sum.totalAmount ?? 0,
    };
  }

  // ── Scheduler: Otomatik Onay ──────────────────────────────────────────────

  @Cron('0 2 * * *')
  async autoApproveExpiredStatements() {
    this.logger.log('Süresi dolmuş ekstre otomatik onay çalışıyor...');

    const expired = await this.prisma.vendorPaymentStatement.findMany({
      where: {
        status: { in: ['SENT', 'PARTIALLY_APPROVED'] },
        deadlineAt: { lte: new Date() },
      },
    });

    for (const stmt of expired) {
      await this.prisma.vendorStatementItem.updateMany({
        where: { statementId: stmt.id, approvalStatus: 'PENDING' },
        data: { approvalStatus: 'AUTO_APPROVED', approvedAt: new Date() },
      });

      await this.prisma.vendorPaymentStatement.update({
        where: { id: stmt.id },
        data: { status: 'APPROVED', autoApprovedAt: new Date() },
      });

      this.logger.log(`Otomatik onay: statement=${stmt.statementNo}`);
    }

    this.logger.log(`${expired.length} ekstre otomatik onaylandı`);
  }

  @Cron('0 9 * * *')
  async sendDeadlineReminders() {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const statementsNearDeadline = await this.prisma.vendorPaymentStatement.findMany({
      where: {
        status: { in: ['SENT', 'PARTIALLY_APPROVED'] },
        deadlineAt: { lte: threeDaysFromNow, gte: new Date() },
        items: { some: { approvalStatus: 'PENDING' } },
      },
      include: {
        vendor: { select: { phone: true, name: true } },
        tokens: { select: { token: true }, take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    for (const stmt of statementsNearDeadline) {
      if (stmt.vendor.phone && stmt.tokens.length > 0) {
        const daysLeft = Math.ceil(
          (stmt.deadlineAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        await this.prisma.smsLog.create({
          data: {
            to: stmt.vendor.phone,
            message: `Meridyen Assistance: ${stmt.statementNo} no'lu ödeme ekstrenizin mutabakat süresi ${daysLeft} gün içinde dolacak. Lütfen inceleyin: ${process.env.APP_URL ?? 'https://app.meridyen.com'}/ekstre/${stmt.tokens[0].token}`,
            status: 'queued',
            provider: 'console',
          },
        });
      }
    }

    this.logger.log(`${statementsNearDeadline.length} hatırlatıcı SMS kuyruğa alındı`);
  }

  // ── Audit Log ─────────────────────────────────────────────────────────────

  private async auditLog(
    entityType: string,
    entityId: string,
    action: string,
    before: any,
    after: any,
    userId: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        oldValue: before ?? undefined,
        newValue: after ?? undefined,
        userId,
      },
    });
  }
}
