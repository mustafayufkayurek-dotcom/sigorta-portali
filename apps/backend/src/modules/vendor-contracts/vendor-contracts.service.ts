import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { buildAppPath } from '@/common/utils/app-url';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  CreateVendorContractDto,
  CreateClauseDto,
  UpdateClauseDto,
  ReorderClausesDto,
  UpdateTemplateDto,
} from './dto/vendor-contracts.dto';

@Injectable()
export class VendorContractsService {
  private readonly logger = new Logger(VendorContractsService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'vendor-contracts');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // ── Template Yönetimi ──────────────────────────────────────────────────────

  async getTemplate() {
    let template = await this.prisma.vendorContractTemplate.findFirst({
      where: { isActive: true },
      include: {
        clauses: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!template) {
      template = await this.prisma.vendorContractTemplate.create({
        data: { name: 'Tedarikçi Onarım Sözleşmesi', isActive: true, version: '1.0' },
        include: { clauses: true },
      });
    }
    return template;
  }

  async updateTemplate(dto: UpdateTemplateDto) {
    const template = await this.getTemplate();
    return this.prisma.vendorContractTemplate.update({
      where: { id: template.id },
      data: dto,
    });
  }

  async getClauses() {
    const template = await this.getTemplate();
    return this.prisma.vendorContractClause.findMany({
      where: { templateId: template.id },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createClause(dto: CreateClauseDto) {
    const template = await this.getTemplate();
    const maxOrder = await this.prisma.vendorContractClause.aggregate({
      where: { templateId: template.id },
      _max: { sortOrder: true },
    });
    return this.prisma.vendorContractClause.create({
      data: {
        templateId: template.id,
        title: dto.title,
        content: dto.content,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
        isRequired: dto.isRequired ?? true,
      },
    });
  }

  async updateClause(id: string, dto: UpdateClauseDto) {
    const clause = await this.prisma.vendorContractClause.findUnique({ where: { id } });
    if (!clause) throw new NotFoundException('Madde bulunamadı');
    return this.prisma.vendorContractClause.update({ where: { id }, data: dto });
  }

  async deleteClause(id: string) {
    const clause = await this.prisma.vendorContractClause.findUnique({ where: { id } });
    if (!clause) throw new NotFoundException('Madde bulunamadı');
    await this.prisma.vendorContractClause.delete({ where: { id } });
    return { message: 'Madde silindi' };
  }

  async reorderClauses(dto: ReorderClausesDto) {
    const updates = dto.ids.map((id, idx) =>
      this.prisma.vendorContractClause.update({
        where: { id },
        data: { sortOrder: idx },
      }),
    );
    await this.prisma.$transaction(updates);
    return this.getClauses();
  }

  // ── Sözleşme Oluşturma ─────────────────────────────────────────────────────

  async create(dto: CreateVendorContractDto, createdByUserId: string) {
    // 1. Veri yükle
    const claimFile = await this.prisma.claimFile.findUnique({
      where: { id: dto.claimFileId },
      include: {
        insuranceCompany: true,
        customer: true,
        propertyAddress: true,
      },
    });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException('Tedarikçi bulunamadı');

    let reportItems: any[] = [];
    if (dto.repairReportId) {
      const report = await this.prisma.repairReport.findUnique({
        where: { id: dto.repairReportId },
        include: { items: { include: { workGroup: true } } },
      });
      if (!report) throw new NotFoundException('Onarım raporu bulunamadı');
      if (report.claimFileId !== dto.claimFileId)
        throw new BadRequestException('Rapor bu dosyaya ait değil');
      reportItems = report.items;
    }

    // 2. Template ve maddeleri yükle
    const template = await this.getTemplate();
    const clauses = await this.prisma.vendorContractClause.findMany({
      where: { templateId: template.id },
      orderBy: { sortOrder: 'asc' },
    });

    // 3. Değişkenleri hazırla
    const contractDate = new Date();
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const deliveryDate = dto.deliveryDate ? new Date(dto.deliveryDate) : null;
    const signDeadlineDays = dto.signDeadlineDays ?? 3;
    const signDeadlineAt = new Date(Date.now() + signDeadlineDays * 24 * 60 * 60 * 1000);

    const totalAmount = reportItems.reduce((s, i) => s + (i.supplierTotal ?? 0), 0);
    const damageAddress = claimFile.propertyAddress
      ? `${claimFile.propertyAddress.addressLine ?? ''} ${claimFile.propertyAddress.district ?? ''} ${claimFile.propertyAddress.city ?? ''}`.trim()
      : '';
    const insuredName =
      claimFile.customer?.fullName ?? claimFile.customer?.companyName ?? '';

    // 4. contractNo üret
    const count = await this.prisma.vendorContract.count();
    const contractNo = `VC-${contractDate.getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    // 5. İş kalemleri HTML tablosu
    const workItemsHtml =
      reportItems.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:left">İş Grubu</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:left">Tanım</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:right">Miktar</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:left">Birim</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:right">Birim Fiyat</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              ${reportItems
                .map(
                  (item) => `<tr>
                <td style="border:1px solid #d1d5db;padding:5px 8px">${item.workGroup?.name ?? '—'}</td>
                <td style="border:1px solid #d1d5db;padding:5px 8px">${item.jobDescription}</td>
                <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right">${item.quantity}</td>
                <td style="border:1px solid #d1d5db;padding:5px 8px">${item.unit}</td>
                <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right">${(item.supplierUnitPrice ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right">${(item.supplierTotal ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
              </tr>`,
                )
                .join('')}
              <tr style="background:#f9fafb;font-weight:bold">
                <td colspan="5" style="border:1px solid #d1d5db;padding:5px 8px;text-align:right">TOPLAM</td>
                <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right">${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
              </tr>
            </tbody>
          </table>`
        : '<p style="color:#6b7280;font-style:italic">İş kalemi bulunmamaktadır.</p>';

    // 6. Placeholder map
    const placeholders: Record<string, string> = {
      '{{sozlesme_no}}': contractNo,
      '{{sozlesme_tarihi}}': contractDate.toLocaleDateString('tr-TR'),
      '{{baslangic_tarihi}}': startDate ? startDate.toLocaleDateString('tr-TR') : '—',
      '{{teslim_tarihi}}': deliveryDate ? deliveryDate.toLocaleDateString('tr-TR') : '—',
      '{{imza_sure_gun}}': String(signDeadlineDays),
      '{{dosya_no}}': claimFile.fileNo,
      '{{sigorta_sirketi}}': claimFile.insuranceCompany?.name ?? '—',
      '{{hasar_adresi}}': damageAddress || '—',
      '{{sigorta_musteri_ad}}': insuredName || '—',
      '{{tedarikci_ad}}': vendor.name,
      '{{tedarikci_vergi_no}}': vendor.taxNumber ?? vendor.identityNo ?? '—',
      '{{tedarikci_adres}}': [vendor.address, vendor.district, vendor.city].filter(Boolean).join(', ') || '—',
      '{{tedarikci_telefon}}': vendor.phone ?? '—',
      '{{is_kalemleri}}': workItemsHtml,
      '{{toplam_tutar}}': `${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`,
    };

    // 7. Maddeleri render et
    const renderedClauses = clauses.map((clause) => {
      let content = clause.content;
      for (const [key, val] of Object.entries(placeholders)) {
        content = content.replaceAll(key, val);
      }
      return { ...clause, content };
    });

    // 8. HTML birleştir
    const renderedContent = this.buildContractHtml({
      contractNo,
      contractDate,
      fileNo: claimFile.fileNo,
      insuranceCompanyName: claimFile.insuranceCompany?.name ?? '',
      vendorName: vendor.name,
      vendorTaxOrIdNo: vendor.taxNumber ?? vendor.identityNo ?? '',
      insuredName,
      damageAddress,
      clauses: renderedClauses,
    });

    // 9. publicToken
    const publicToken = randomUUID();
    const publicTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün

    // 10. Kaydet
    const contract = await this.prisma.vendorContract.create({
      data: {
        contractNo,
        claimFileId: dto.claimFileId,
        vendorId: dto.vendorId,
        repairReportId: dto.repairReportId ?? null,
        templateId: template.id,
        contractDate,
        startDate,
        deliveryDate,
        signDeadlineAt,
        vendorName: vendor.name,
        vendorTaxOrIdNo: vendor.taxNumber ?? vendor.identityNo ?? null,
        vendorAddress: [vendor.address, vendor.district, vendor.city].filter(Boolean).join(', ') || null,
        vendorPhone: vendor.phone ?? null,
        insuredName: insuredName || null,
        fileNo: claimFile.fileNo,
        insuranceCompanyName: claimFile.insuranceCompany?.name ?? null,
        damageAddress: damageAddress || null,
        workItems: reportItems.map((i) => ({
          id: i.id,
          jobDescription: i.jobDescription,
          quantity: i.quantity,
          unit: i.unit,
          supplierUnitPrice: i.supplierUnitPrice,
          supplierTotal: i.supplierTotal,
          workGroupName: i.workGroup?.name ?? null,
        })),
        renderedContent,
        status: 'draft',
        publicToken,
        publicTokenExpiresAt,
        createdByUserId,
      },
      include: {
        claimFile: { include: { insuranceCompany: true } },
        vendor: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // 11. PDF üret (async, hata olsa kayıt bozulmasın)
    try {
      const pdfKey = await this.generatePdf(contract.id, renderedContent);
      await this.prisma.vendorContract.update({
        where: { id: contract.id },
        data: { pdfStorageKey: pdfKey, status: 'ready' },
      });
      return { ...contract, pdfStorageKey: pdfKey, status: 'ready' };
    } catch (err) {
      this.logger.error(`PDF üretim hatası [${contract.id}]: ${err}`);
      return contract;
    }
  }

  // ── Liste & Detay ──────────────────────────────────────────────────────────

  async findByClaimFile(claimFileId: string) {
    return this.prisma.vendorContract.findMany({
      where: { claimFileId },
      include: {
        vendor: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const contract = await this.prisma.vendorContract.findUnique({
      where: { id },
      include: {
        claimFile: { include: { insuranceCompany: true, customer: true } },
        vendor: true,
        repairReport: { select: { id: true, reportNo: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!contract) throw new NotFoundException('Sözleşme bulunamadı');
    return contract;
  }

  async cancel(id: string) {
    await this.findOne(id);
    return this.prisma.vendorContract.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  // ── PDF İndirme ─────────────────────────────────────────────────────────────

  async getPdfPath(id: string): Promise<string> {
    const contract = await this.findOne(id);
    if (!contract.pdfStorageKey) {
      // PDF yoksa yeniden üret
      const pdfKey = await this.generatePdf(id, contract.renderedContent);
      await this.prisma.vendorContract.update({
        where: { id },
        data: { pdfStorageKey: pdfKey },
      });
      return path.join(process.cwd(), 'uploads', 'vendor-contracts', path.basename(pdfKey));
    }
    return path.join(process.cwd(), 'uploads', 'vendor-contracts', path.basename(contract.pdfStorageKey));
  }

  // ── WhatsApp Gönderim ──────────────────────────────────────────────────────

  async recordWhatsappSent(id: string, phone: string) {
    const contract = await this.findOne(id);
    const link = buildAppPath(this.config, `/sozlesme/${contract.publicToken}`);
    const message = encodeURIComponent(
      `Sayın ${contract.vendorName},\n\nMeridyen Assistance tarafından "${contract.fileNo}" numaralı dosya için düzenlenen tedarikçi sözleşmesini aşağıdaki linkten inceleyebilir ve imzalayabilirsiniz:\n\n${link}\n\nSözleşme No: ${contract.contractNo}\nİmza Son Tarihi: ${contract.signDeadlineAt ? new Date(contract.signDeadlineAt).toLocaleDateString('tr-TR') : '—'}\n\nMeridyen Assistance`,
    );
    const waUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`;

    await this.prisma.vendorContract.update({
      where: { id },
      data: {
        whatsappSentAt: new Date(),
        whatsappPhone: phone,
        status: contract.status === 'draft' || contract.status === 'ready' ? 'sent' : contract.status,
      },
    });

    return { waUrl, link };
  }

  async sendReminder(id: string) {
    const contract = await this.findOne(id);
    if (contract.status === 'vendor_signed' || contract.status === 'cancelled') {
      throw new BadRequestException('Bu sözleşme için hatırlatma gönderilemez');
    }
    if (!contract.whatsappPhone) {
      throw new BadRequestException('WhatsApp numarası kayıtlı değil');
    }
    const result = await this.recordWhatsappSent(id, contract.whatsappPhone);
    await this.prisma.vendorContract.update({
      where: { id },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: new Date(),
      },
    });
    return result;
  }

  // ── Public Token — Tedarikçi Görüntüleme & İmzalama ───────────────────────

  async findByToken(token: string) {
    const contract = await this.prisma.vendorContract.findUnique({
      where: { publicToken: token },
      select: {
        id: true,
        contractNo: true,
        contractDate: true,
        startDate: true,
        deliveryDate: true,
        signDeadlineAt: true,
        vendorName: true,
        fileNo: true,
        insuranceCompanyName: true,
        renderedContent: true,
        status: true,
        signedAt: true,
        publicTokenExpiresAt: true,
      },
    });
    if (!contract) throw new NotFoundException('Sözleşme bulunamadı');
    if (contract.publicTokenExpiresAt && contract.publicTokenExpiresAt < new Date()) {
      throw new BadRequestException('Bu sözleşme linki süresi dolmuştur');
    }
    return contract;
  }

  async signByToken(token: string, fullName: string) {
    const contract = await this.prisma.vendorContract.findUnique({
      where: { publicToken: token },
    });
    if (!contract) throw new NotFoundException('Sözleşme bulunamadı');
    if (contract.publicTokenExpiresAt && contract.publicTokenExpiresAt < new Date()) {
      throw new BadRequestException('Bu sözleşme linki süresi dolmuştur');
    }
    if (contract.status === 'vendor_signed') {
      throw new BadRequestException('Bu sözleşme zaten imzalanmıştır');
    }
    if (contract.status === 'cancelled') {
      throw new BadRequestException('Bu sözleşme iptal edilmiştir');
    }

    const signedAt = new Date();
    const signatureData = `accepted:${fullName}:${signedAt.toISOString()}`;

    // Imzalı PDF'i yeniden üret (imza bilgisi eklenmiş)
    const signedHtml = this.buildSignedHtml(contract.renderedContent, fullName, signedAt);
    let pdfKey = contract.pdfStorageKey;
    try {
      pdfKey = await this.generatePdf(contract.id, signedHtml, true);
    } catch (err) {
      this.logger.error(`İmzalı PDF üretim hatası: ${err}`);
    }

    return this.prisma.vendorContract.update({
      where: { id: contract.id },
      data: {
        status: 'vendor_signed',
        signedAt,
        vendorSignatureData: signatureData,
        pdfStorageKey: pdfKey,
      },
    });
  }

  // ── Scheduler için toplu hatırlatma ───────────────────────────────────────

  async processDailyReminders() {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const contracts = await this.prisma.vendorContract.findMany({
      where: {
        status: 'sent',
        signedAt: null,
        signDeadlineAt: { gt: now },
        OR: [
          { lastReminderAt: null },
          { lastReminderAt: { lt: yesterday } },
        ],
      },
    });

    let sent = 0;
    for (const c of contracts) {
      if (!c.whatsappPhone) continue;
      try {
        await this.sendReminder(c.id);
        sent++;
      } catch (err) {
        this.logger.warn(`Hatırlatma gönderilemedi [${c.id}]: ${err}`);
      }
    }
    this.logger.log(`Günlük hatırlatma: ${sent}/${contracts.length} gönderildi`);
    return { sent, total: contracts.length };
  }

  // ── PDF Üretimi (Puppeteer) ────────────────────────────────────────────────

  private async generatePdf(contractId: string, html: string, isSigned = false): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const fileName = `${contractId}${isSigned ? '_signed' : ''}.pdf`;
      const filePath = path.join(this.uploadDir, fileName);
      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: { top: '20mm', bottom: '25mm', left: '20mm', right: '20mm' },
        printBackground: true,
      });
      return `vendor-contracts/${fileName}`;
    } finally {
      await browser.close();
    }
  }

  // ── HTML Şablonu ──────────────────────────────────────────────────────────

  private buildContractHtml(opts: {
    contractNo: string;
    contractDate: Date;
    fileNo: string;
    insuranceCompanyName: string;
    vendorName: string;
    vendorTaxOrIdNo: string;
    insuredName: string;
    damageAddress: string;
    clauses: Array<{ title: string; content: string }>;
  }): string {
    const clausesHtml = opts.clauses
      .map(
        (c, i) => `
        <div style="margin-bottom:16px">
          <h3 style="font-size:13px;font-weight:bold;color:#1a4080;margin:0 0 6px 0;border-bottom:1px solid #e5e7eb;padding-bottom:4px">
            MADDE ${i + 1}: ${c.title}
          </h3>
          <div style="font-size:12px;color:#374151;line-height:1.6">${c.content}</div>
        </div>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tedarikçi Sözleşmesi - ${opts.contractNo}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #1f2937;
      margin: 0;
      padding: 0;
      background: white;
      -webkit-user-select: none;
      user-select: none;
    }
    @media print { body { display: none !important; } }
    .page { padding: 20px; max-width: 800px; margin: 0 auto; position: relative; }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 72px;
      font-weight: bold;
      color: rgba(200, 200, 200, 0.18);
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
      letter-spacing: 4px;
    }
    .content { position: relative; z-index: 1; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a4080; padding-bottom: 12px; margin-bottom: 16px; }
    .header-left h1 { font-size: 18px; font-weight: bold; color: #1a4080; margin: 0; }
    .header-left p { font-size: 11px; color: #6b7280; margin: 2px 0 0; }
    .header-right { text-align: right; font-size: 11px; color: #374151; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
    .info-item label { font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 2px; }
    .info-item span { font-size: 12px; color: #111827; font-weight: 500; }
    .signature-section { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .sig-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 16px; }
    .sig-box h4 { font-size: 11px; font-weight: bold; color: #374151; margin: 0 0 8px; text-transform: uppercase; }
    .sig-line { border-top: 1px solid #9ca3af; margin-top: 40px; padding-top: 6px; font-size: 10px; color: #6b7280; }
    .electronic-badge { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 10px; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 6px; }
    .footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 10px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
<div class="watermark">MEKİDYEN ASSISTANCE — GİZLİ</div>
<div class="page">
  <div class="content">
    <div class="header">
      <div class="header-left">
        <h1>TEDARİKÇİ ONARIM SÖZLEŞMESİ</h1>
        <p>Meridyen Assistance — Tedarikçi İş Sözleşmesi</p>
      </div>
      <div class="header-right">
        <div><strong>${opts.contractNo}</strong></div>
        <div>${opts.contractDate.toLocaleDateString('tr-TR')}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-item"><label>Dosya No</label><span>${opts.fileNo}</span></div>
      <div class="info-item"><label>Sigorta Şirketi</label><span>${opts.insuranceCompanyName || '—'}</span></div>
      <div class="info-item"><label>Sigortalı</label><span>${opts.insuredName || '—'}</span></div>
      <div class="info-item"><label>Hasar Adresi</label><span>${opts.damageAddress || '—'}</span></div>
      <div class="info-item"><label>Tedarikçi / Taşeron</label><span>${opts.vendorName}</span></div>
      <div class="info-item"><label>Vergi / TC No</label><span>${opts.vendorTaxOrIdNo || '—'}</span></div>
    </div>

    ${clausesHtml}

    <div class="signature-section">
      <div class="sig-box">
        <h4>Meridyen Assistance Adına</h4>
        <div class="electronic-badge">Elektronik imza kullanılmıştır</div>
        <div class="sig-line">Meridyen Assistance · ${opts.contractDate.toLocaleDateString('tr-TR')}</div>
      </div>
      <div class="sig-box">
        <h4>Tedarikçi / Taşeron</h4>
        <p style="font-size:11px;color:#6b7280;margin:4px 0">Ad Soyad / Kaşe</p>
        <div class="sig-line">İmza · Tarih</div>
      </div>
    </div>

    <div class="footer">
      Bu belge Meridyen Assistance tarafından otomatik oluşturulmuştur. Yetkisiz kopyalanması ve dağıtılması yasaktır.
    </div>
  </div>
</div>
</body>
</html>`;
  }

  private buildSignedHtml(originalHtml: string, fullName: string, signedAt: Date): string {
    const signedBadge = `
      <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:12px">
        <strong style="color:#15803d">Tedarikçi Dijital Onayı</strong><br>
        <span style="color:#166534">${fullName}</span> tarafından 
        <span style="color:#166534">${signedAt.toLocaleString('tr-TR')}</span> tarihinde onaylanmıştır.
      </div>`;
    return originalHtml.replace('</body>', `${signedBadge}</body>`);
  }
}
