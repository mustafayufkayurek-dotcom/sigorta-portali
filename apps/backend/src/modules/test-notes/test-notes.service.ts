import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import * as ExcelJS from 'exceljs';
import {
  CreateTestNoteDto,
  CreateWorkItemDto,
  GenerateTestNoteFormatDto,
  TestNoteFilterDto,
  UpdateTestNoteDto,
  UpdateWorkItemDto,
  WorkItemFilterDto,
} from './dto/test-notes.dto';

type PrismaWithTestNotes = PrismaService & {
  testNote: any;
  testNoteFormat: any;
  workItem: any;
};

@Injectable()
export class TestNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private get db(): PrismaWithTestNotes {
    return this.prisma as PrismaWithTestNotes;
  }

  async findAllTestNotes(filters: TestNoteFilterDto) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 200);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.oncelik) where.oncelik = filters.oncelik;
    if (filters.durum) where.durum = filters.durum;
    if (typeof filters.tekrarDurumu === 'boolean') where.tekrarDurumu = filters.tekrarDurumu;
    if (typeof filters.isArchived === 'boolean') where.isArchived = filters.isArchived;
    if (filters.search?.trim()) {
      where.OR = [
        { testNo: { contains: filters.search, mode: 'insensitive' } },
        { ekranModul: { contains: filters.search, mode: 'insensitive' } },
        { kullaniciGozlemi: { contains: filters.search, mode: 'insensitive' } },
        { beklenenDavranis: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.db.testNote.count({ where }),
      this.db.testNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          format: true,
        },
      }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneTestNote(id: string) {
    const data = await this.db.testNote.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        format: true,
      },
    });
    if (!data) {
      throw new NotFoundException('Test notu bulunamadı');
    }
    return data;
  }

  async createTestNote(dto: CreateTestNoteDto, userId: string) {
    const testNo = await this.generateNextTestNo();
    const created = await this.db.testNote.create({
      data: {
        testNo,
        ekranModul: dto.ekranModul.trim(),
        kullaniciGozlemi: dto.kullaniciGozlemi.trim(),
        beklenenDavranis: dto.beklenenDavranis.trim(),
        ekranGoruntusu: dto.ekranGoruntusu?.trim() || null,
        oncelik: dto.oncelik as any,
        durum: (dto.durum ?? 'YENI') as any,
        tekrarDurumu: dto.tekrarDurumu ?? false,
        isArchived: dto.isArchived ?? false,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        format: true,
      },
    });

    this.auditLogsService.log({
      entityType: 'TestNote',
      entityId: created.id,
      action: 'CREATE',
      newValue: created,
      userId,
    });

    return created;
  }

  async updateTestNote(id: string, dto: UpdateTestNoteDto, userId: string) {
    const previous = await this.findOneTestNote(id);
    const updated = await this.db.testNote.update({
      where: { id },
      data: {
        ...(dto.ekranModul !== undefined ? { ekranModul: dto.ekranModul.trim() } : {}),
        ...(dto.kullaniciGozlemi !== undefined ? { kullaniciGozlemi: dto.kullaniciGozlemi.trim() } : {}),
        ...(dto.beklenenDavranis !== undefined ? { beklenenDavranis: dto.beklenenDavranis.trim() } : {}),
        ...(dto.ekranGoruntusu !== undefined ? { ekranGoruntusu: dto.ekranGoruntusu?.trim() || null } : {}),
        ...(dto.oncelik !== undefined ? { oncelik: dto.oncelik as any } : {}),
        ...(dto.durum !== undefined ? { durum: dto.durum as any } : {}),
        ...(dto.tekrarDurumu !== undefined ? { tekrarDurumu: dto.tekrarDurumu } : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
        ...(dto.managerIslemNotu !== undefined ? { managerIslemNotu: dto.managerIslemNotu?.trim() || null } : {}),
        ...(dto.managerIslemNotu !== undefined || dto.durum !== undefined ? { islemTarihi: new Date() } : {}),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        format: true,
      },
    });

    this.auditLogsService.log({
      entityType: 'TestNote',
      entityId: id,
      action: 'UPDATE',
      oldValue: previous,
      newValue: updated,
      userId,
    });

    return updated;
  }

  async removeTestNote(id: string, userId: string) {
    const previous = await this.findOneTestNote(id);
    await this.db.testNote.delete({ where: { id } });
    this.auditLogsService.log({
      entityType: 'TestNote',
      entityId: id,
      action: 'DELETE',
      oldValue: previous,
      userId,
    });
    return { success: true };
  }

  async generateFormat(id: string, dto: GenerateTestNoteFormatDto, userId: string) {
    const note = await this.findOneTestNote(id);
    const etkiSinifi = dto.etkiSinifi?.trim() || this.resolveImpactClass(note.oncelik);
    const payload = {
      sorunOzeti: note.kullaniciGozlemi,
      beklenenDavranis: note.beklenenDavranis,
      etkiSinifi,
      oncelik: note.oncelik,
      muhendislikTalimati: this.buildEngineeringInstruction(note),
      kabulKriteri: this.buildAcceptanceCriteria(note),
      kanitBeklentisi: this.buildEvidenceExpectation(note),
      onayli: false,
    };

    const data = await this.db.testNoteFormat.upsert({
      where: { testNoteId: id },
      update: payload,
      create: {
        testNoteId: id,
        ...payload,
      },
    });

    this.auditLogsService.log({
      entityType: 'TestNoteFormat',
      entityId: data.id,
      action: 'UPSERT',
      newValue: data,
      userId,
    });

    return data;
  }

  async findAllWorkItems(filters: WorkItemFilterDto) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 200);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.kaynak) where.kaynak = filters.kaynak;
    if (filters.oncelik) where.oncelik = filters.oncelik;
    if (filters.durum) where.durum = filters.durum;
    if (filters.sorumluId) where.sorumluId = filters.sorumluId;
    if (typeof filters.isArchived === 'boolean') where.isArchived = filters.isArchived;
    if (filters.search?.trim()) {
      where.OR = [
        { konu: { contains: filters.search, mode: 'insensitive' } },
        { kullaniciYorumu: { contains: filters.search, mode: 'insensitive' } },
        { kapanisNotu: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.db.workItem.count({ where }),
      this.db.workItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isArchived: 'asc' }, { oncelik: 'asc' }, { createdAt: 'desc' }],
        include: {
          sorumlu: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneWorkItem(id: string) {
    const data = await this.db.workItem.findUnique({
      where: { id },
      include: {
        sorumlu: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!data) {
      throw new NotFoundException('İş/görev kaydı bulunamadı');
    }
    return data;
  }

  async createWorkItem(dto: CreateWorkItemDto, userId: string) {
    if (dto.sorumluId) {
      await this.ensureUserExists(dto.sorumluId);
    }

    const created = await this.db.workItem.create({
      data: {
        konu: dto.konu.trim(),
        kaynak: dto.kaynak as any,
        oncelik: dto.oncelik as any,
        sorumluId: dto.sorumluId ?? null,
        hedefTarih: dto.hedefTarih ? new Date(dto.hedefTarih) : null,
        hatirlatmaTarih: dto.hatirlatmaTarih ? new Date(dto.hatirlatmaTarih) : null,
        durum: (dto.durum ?? 'ACIK') as any,
        kullaniciYorumu: dto.kullaniciYorumu?.trim() || null,
        kanit: dto.kanit?.trim() || null,
        kapanisNotu: dto.kapanisNotu?.trim() || null,
        isArchived: dto.isArchived ?? false,
      },
      include: {
        sorumlu: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    this.auditLogsService.log({
      entityType: 'WorkItem',
      entityId: created.id,
      action: 'CREATE',
      newValue: created,
      userId,
    });

    return created;
  }

  async updateWorkItem(id: string, dto: UpdateWorkItemDto, userId: string) {
    const previous = await this.findOneWorkItem(id);
    if (dto.sorumluId) {
      await this.ensureUserExists(dto.sorumluId);
    }
    const updated = await this.db.workItem.update({
      where: { id },
      data: {
        ...(dto.konu !== undefined ? { konu: dto.konu.trim() } : {}),
        ...(dto.kaynak !== undefined ? { kaynak: dto.kaynak as any } : {}),
        ...(dto.oncelik !== undefined ? { oncelik: dto.oncelik as any } : {}),
        ...(dto.sorumluId !== undefined ? { sorumluId: dto.sorumluId || null } : {}),
        ...(dto.hedefTarih !== undefined ? { hedefTarih: dto.hedefTarih ? new Date(dto.hedefTarih) : null } : {}),
        ...(dto.hatirlatmaTarih !== undefined ? { hatirlatmaTarih: dto.hatirlatmaTarih ? new Date(dto.hatirlatmaTarih) : null } : {}),
        ...(dto.durum !== undefined ? { durum: dto.durum as any } : {}),
        ...(dto.kullaniciYorumu !== undefined ? { kullaniciYorumu: dto.kullaniciYorumu?.trim() || null } : {}),
        ...(dto.kanit !== undefined ? { kanit: dto.kanit?.trim() || null } : {}),
        ...(dto.kapanisNotu !== undefined ? { kapanisNotu: dto.kapanisNotu?.trim() || null } : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
        ...(dto.managerIslemNotu !== undefined ? { managerIslemNotu: dto.managerIslemNotu?.trim() || null } : {}),
        ...(dto.managerIslemNotu !== undefined || dto.durum !== undefined ? { islemTarihi: new Date() } : {}),
      },
      include: {
        sorumlu: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    this.auditLogsService.log({
      entityType: 'WorkItem',
      entityId: id,
      action: 'UPDATE',
      oldValue: previous,
      newValue: updated,
      userId,
    });

    return updated;
  }

  async removeWorkItem(id: string, userId: string) {
    const previous = await this.findOneWorkItem(id);
    await this.db.workItem.delete({ where: { id } });
    this.auditLogsService.log({
      entityType: 'WorkItem',
      entityId: id,
      action: 'DELETE',
      oldValue: previous,
      userId,
    });
    return { success: true };
  }

  async exportExcel(testNoteFilters: TestNoteFilterDto, workItemFilters: WorkItemFilterDto) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sigorta Hasar Yönetimi';
    workbook.created = new Date();

    const [testNotesResult, workItemsResult, formatRows] = await Promise.all([
      this.findAllTestNotes({ ...testNoteFilters, page: 1, limit: 5000 }),
      this.findAllWorkItems({ ...workItemFilters, page: 1, limit: 5000 }),
      this.db.testNoteFormat.findMany({
        include: {
          testNote: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };

    const notesSheet = workbook.addWorksheet('Test Notları');
    this.addHeaders(notesSheet, ['Test No', 'Modül', 'Gözlem', 'Beklenen', 'Öncelik', 'Durum', 'Yapılan İşlem', 'İşlem Tarihi', 'Kanıt Linki (Oturum Gerekli)', 'Tekrar', 'Arşiv', 'Oluşturan', 'Tarih'], headerStyle);
    testNotesResult.data.forEach((row: any) => {
      notesSheet.addRow([
        row.testNo,
        row.ekranModul,
        row.kullaniciGozlemi,
        row.beklenenDavranis,
        row.oncelik,
        row.durum,
        row.managerIslemNotu ?? '',
        row.islemTarihi ?? '',
        row.ekranGoruntusu ? { text: row.ekranGoruntusu, hyperlink: row.ekranGoruntusu } : '',
        row.tekrarDurumu ? 'Evet' : 'Hayır',
        row.isArchived ? 'Evet' : 'Hayır',
        `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim(),
        row.createdAt,
      ]);
    });
    notesSheet.columns = [
      { width: 16 }, { width: 24 }, { width: 40 }, { width: 40 }, { width: 14 },
      { width: 18 }, { width: 30 }, { width: 20 }, { width: 40 }, { width: 10 }, { width: 10 }, { width: 24 }, { width: 20 },
    ];

    const workSheet = workbook.addWorksheet('İşler-Kararlar');
    this.addHeaders(workSheet, ['Sıra No', 'Konu', 'Kaynak', 'Öncelik', 'Durum', 'Sorumlu', 'Hedef Tarih', 'Hatırlatma', 'Arşiv'], headerStyle);
    workItemsResult.data.forEach((row: any) => {
      workSheet.addRow([
        row.siraNo,
        row.konu,
        row.kaynak,
        row.oncelik,
        row.durum,
        row.sorumlu ? `${row.sorumlu.firstName} ${row.sorumlu.lastName}`.trim() : '',
        row.hedefTarih ?? '',
        row.hatirlatmaTarih ?? '',
        row.isArchived ? 'Evet' : 'Hayır',
      ]);
    });
    workSheet.columns = [
      { width: 10 }, { width: 42 }, { width: 18 }, { width: 14 }, { width: 18 },
      { width: 24 }, { width: 18 }, { width: 18 }, { width: 10 },
    ];

    const formatSheet = workbook.addWorksheet('Danışman Formatı');
    this.addHeaders(formatSheet, ['Test No', 'Sorun Özeti', 'Beklenen Davranış', 'Etki Sınıfı', 'Öncelik', 'Mühendislik Talimatı', 'Kabul Kriteri', 'Kanıt Beklentisi', 'Onaylı'], headerStyle);
    formatRows.forEach((row: any) => {
      formatSheet.addRow([
        row.testNote.testNo,
        row.sorunOzeti,
        row.beklenenDavranis,
        row.etkiSinifi,
        row.oncelik,
        row.muhendislikTalimati,
        row.kabulKriteri,
        row.kanitBeklentisi,
        row.onayli ? 'Evet' : 'Hayır',
      ]);
    });
    formatSheet.columns = [
      { width: 16 }, { width: 40 }, { width: 40 }, { width: 18 }, { width: 14 },
      { width: 42 }, { width: 42 }, { width: 32 }, { width: 10 },
    ];

    const summarySheet = workbook.addWorksheet('Durum Özeti');
    this.addHeaders(summarySheet, ['Kategori', 'Metrik', 'Değer'], headerStyle);
    const testStatusCounts = this.countBy(testNotesResult.data.map((item: any) => item.durum));
    const workStatusCounts = this.countBy(workItemsResult.data.map((item: any) => item.durum));
    summarySheet.addRow(['Test Notları', 'Toplam', testNotesResult.meta.total]);
    Object.entries(testStatusCounts).forEach(([key, value]) => summarySheet.addRow(['Test Notları', key, value]));
    summarySheet.addRow(['İşler-Kararlar', 'Toplam', workItemsResult.meta.total]);
    Object.entries(workStatusCounts).forEach(([key, value]) => summarySheet.addRow(['İşler-Kararlar', key, value]));
    summarySheet.columns = [{ width: 18 }, { width: 24 }, { width: 12 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private addHeaders(sheet: ExcelJS.Worksheet, headers: string[], style: Partial<ExcelJS.Style>) {
    const row = sheet.addRow(headers);
    row.eachCell((cell) => {
      cell.style = style as ExcelJS.Style;
    });
  }

  private countBy(values: string[]) {
    return values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});
  }

  private async generateNextTestNo() {
    const year = new Date().getFullYear();
    const prefix = `TN-${year}-`;
    const last = await this.db.testNote.findFirst({
      where: { testNo: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { testNo: true },
    });
    const lastSeq = last?.testNo ? Number(last.testNo.split('-').pop()) : 0;
    const next = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  private resolveImpactClass(priority: string) {
    switch (priority) {
      case 'P0':
        return 'Kritik kullanıcı etkisi';
      case 'P1':
        return 'Yüksek operasyonel etki';
      case 'KARAR_GEREKLI':
        return 'İş kararı gerektiriyor';
      default:
        return 'Sınırlı kullanıcı etkisi';
    }
  }

  private buildEngineeringInstruction(note: { ekranModul: string; kullaniciGozlemi: string; beklenenDavranis: string }) {
    return `${note.ekranModul} ekranında bildirilen davranışı yeniden üret, kök nedeni düzelt, beklenen davranışı sağlayıp regresyonu kontrol et.`;
  }

  private buildAcceptanceCriteria(note: { beklenenDavranis: string }) {
    return `Kullanıcı akışında "${note.beklenenDavranis}" sonucu kararlı biçimde elde edilmeli.`;
  }

  private buildEvidenceExpectation(note: { ekranModul: string }) {
    return `${note.ekranModul} ekranı için düzeltme sonrası ekran görüntüsü ve ilgili test/işlem çıktısı paylaşılmalı.`;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new BadRequestException('Sorumlu kullanıcı bulunamadı');
    }
  }
}