import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { getDocumentBranding, DOCUMENT_HEADER_STYLES } from '@/common/utils/document-branding';
import { buildAppPath } from '@/common/utils/app-url';
import { toTitleCaseTR } from '@/common/utils/text-helpers';
import { randomUUID } from 'crypto';
import {
  CreateFileDocumentDto,
  SendWhatsappDto,
} from './dto/file-documents.dto';
import { MUVAFAKATNAME_TEMPLATE } from './muvafakatname.template';

/** Müşteriye dönük matbu — iç fiyat / kâr etiketleri sızmaz */
const INTERNAL_COST_DESC_RE =
  /alış\s*fiyat|satış\s*fiyat|tedarikçi\s*maliyet|müşteri\s*satış|meridyen\s*satış|kâr\s*oran/i;

function isCustomerFacingWorkSummary(description: string | null | undefined): boolean {
  const t = (description ?? '').trim();
  if (!t) return false;
  if (INTERNAL_COST_DESC_RE.test(t)) return false;
  return true;
}

function buildEmergencyMatbuWorkSummary(ec: {
  issueType: string;
  notes?: string | null;
  costEntries: Array<{ description: string; entryType?: string }>;
}): string {
  const usable = ec.costEntries
    .map((c) => (c.description ?? '').trim())
    .filter((d) => isCustomerFacingWorkSummary(d));

  if (usable.length > 0) {
    return usable.map((d) => `• ${toTitleCaseTR(d)}`).join('\n');
  }

  const notes = (ec.notes ?? '').trim();
  if (notes && isCustomerFacingWorkSummary(notes)) {
    return toTitleCaseTR(notes);
  }

  const issue = toTitleCaseTR((ec.issueType ?? '').trim()) || 'Acil Yardım';
  return `${issue} Hizmeti Tamamlandı.`;
}

const MATBU_EVRAK_TEMPLATE = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Hizmet Onay Formu — {{case_no}}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1f2937; margin: 0; padding: 0; background: white; }
    .page { padding: 28px; max-width: 780px; margin: 0 auto; }
${DOCUMENT_HEADER_STYLES}
    h1 { text-align: center; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; margin: 0 0 4px; color: #1a4080; }
    .form-subtitle { text-align: center; font-size: 11px; color: #6b7280; margin: 0 0 20px; }
    .header-right { text-align: right; font-size: 11px; color: #374151; margin-bottom: 20px; }
    .header-right strong { display: block; font-size: 13px; color: #111827; }
    .section { margin-bottom: 18px; }
    .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #6b7280; letter-spacing: 0.04em; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
    .info-row { display: flex; gap: 6px; font-size: 12px; }
    .info-row .label { color: #6b7280; white-space: nowrap; min-width: 110px; }
    .info-row .value { color: #111827; font-weight: 500; }
    .is-ozeti { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 12px; color: #374151; min-height: 60px; }
    .tutar-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
    .tutar-box .label { font-size: 12px; color: #1e40af; font-weight: 600; }
    .tutar-box .value { font-size: 16px; font-weight: bold; color: #1e3a8a; }
    .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; }
    .sig-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 14px; }
    .sig-box h4 { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #374151; margin: 0 0 6px; }
    .sig-box .sig-info { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
    .sig-line { border-top: 1px solid #9ca3af; margin-top: 44px; padding-top: 5px; font-size: 10px; color: #9ca3af; }
    .consent-text { font-size: 11px; color: #4b5563; line-height: 1.6; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; }
    .footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 10px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
<div class="page">

  <div class="doc-header">
    <div class="doc-header-logo">
      <img src="{{logo_url}}" alt="Meridyen Assistance" />
    </div>
    <div class="doc-header-meta">
      <strong>{{sirket_ad}}</strong>
      {{sirket_adres}}
    </div>
  </div>

  <h1>Hizmet Onay Formu</h1>
  <p class="form-subtitle">Meridyen Assistance — Acil Yardım Hizmetleri</p>

  <div class="header-right">
    <strong>{{case_no}}</strong>
    Düzenlenme Tarihi: {{tarih}}
  </div>

  <!-- Müşteri & Vaka Bilgileri -->
  <div class="section">
    <div class="section-title">Müşteri ve Dosya Bilgileri</div>
    <div class="info-grid">
      <div class="info-row"><span class="label">Ad Soyad:</span><span class="value">{{musteri_ad}}</span></div>
      <div class="info-row"><span class="label">Telefon:</span><span class="value">{{musteri_telefon}}</span></div>
      <div class="info-row"><span class="label">Hizmet Adresi:</span><span class="value">{{adres}}</span></div>
      <div class="info-row"><span class="label">İlçe / İl:</span><span class="value">{{ilce_il}}</span></div>
      <div class="info-row"><span class="label">Dosya No:</span><span class="value">{{dosya_no}}</span></div>
      <div class="info-row"><span class="label">Hizmet Türü:</span><span class="value">{{konu}}</span></div>
      <div class="info-row"><span class="label">Tedarikçi / Ekip:</span><span class="value">{{tedarikci}}</span></div>
      <div class="info-row"><span class="label">Hizmet Tarihi:</span><span class="value">{{tarih}}</span></div>
    </div>
  </div>

  <!-- Yapılan İş Özeti -->
  <div class="section">
    <div class="section-title">Yapılan İş Özeti</div>
    <div class="is-ozeti">{{is_ozeti}}</div>
  </div>

  <!-- Tutar -->
  <div class="section">
    <div class="tutar-box">
      <span class="label">Toplam Hizmet Bedeli (KDV Dahil)</span>
      <span class="value">{{toplam_tutar}} ₺</span>
    </div>
  </div>

  <!-- Onay Metni -->
  <div class="consent-text">
    Ben, aşağıda imzası bulunan <strong>{{musteri_ad}}</strong>, Meridyen Assistance tarafından yukarıda
    belirtilen adreste gerçekleştirilen hizmetin eksiksiz ve kabul edilebilir kalitede tamamlandığını,
    açıklanan toplam bedeli onayladığımı beyan ederim. Bu formun imzalanması ile söz konusu hizmet
    bedelinin sigorta şirketine veya ilgili taraflara fatura edilmesine muvafakat etmiş sayılırım.
  </div>

  <!-- İmza Alanları -->
  <div class="signature-section">
    <div class="sig-box">
      <h4>Hizmet Veren</h4>
      <p class="sig-info">Meridyen Assistance</p>
      <p class="sig-info">Yetkili: ____________________</p>
      <div class="sig-line">İmza · Tarih</div>
    </div>
    <div class="sig-box">
      <h4>Müşteri / Hak Sahibi</h4>
      <p class="sig-info">Ad Soyad: ____________________</p>
      <p class="sig-info">T.C. Kimlik No: ________________</p>
      <div class="sig-line">İmza · Tarih</div>
    </div>
  </div>

  <div class="footer">
    Bu form Meridyen Assistance tarafından düzenlenmiştir. Dosya No: {{case_no}} · {{tarih}}
  </div>

</div>
</body>
</html>`;

@Injectable()
export class FileDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private renderTemplate(template: string, placeholders: Record<string, string>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(placeholders)) {
      rendered = rendered.replaceAll(key, value);
    }
    return rendered;
  }

  private async getDocumentCompanyPlaceholders(): Promise<Record<string, string>> {
    const branding = await getDocumentBranding(this.prisma, this.config);

    return {
      '{{logo_url}}': branding.logoUrl,
      '{{sirket_ad}}': branding.companyName,
      '{{sirket_adres}}': branding.companyAddress,
      '{{servis_veren}}': branding.servisVeren,
      '{{servis_veren_adres}}': branding.servisVerenAdres,
      '{{musteri_hizmetleri}}': branding.musteriHizmetleri,
      '{{whatsapp_hatti}}': branding.whatsappHatti,
    };
  }

  private formatCurrency(amount: number | null | undefined): string {
    if (amount == null || Number.isNaN(amount)) return '—';
    return amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Oluşturma ─────────────────────────────────────────────────────────────

  async create(dto: CreateFileDocumentDto, createdByUserId: string) {
    // Varlığı doğrula
    if (dto.entityType === 'claim_file') {
      const cf = await this.prisma.claimFile.findUnique({
        where: { id: dto.entityId },
        include: {
          insuranceCompany: true,
          customer: true,
          propertyAddress: true,
          budgetVersions: {
            orderBy: { versionNo: 'desc' },
            take: 1,
            select: { totalAmount: true },
          },
        },
      });
      if (!cf) throw new NotFoundException('Hasar dosyası bulunamadı');

      const insuredName =
        cf.customer?.fullName ??
        cf.customer?.companyName ??
        `${cf.customer?.firstName ?? ''} ${cf.customer?.lastName ?? ''}`.trim();
      const damageAddress = cf.propertyAddress
        ? `${cf.propertyAddress.addressLine ?? ''} ${cf.propertyAddress.district ?? ''} ${cf.propertyAddress.city ?? ''}`.trim()
        : '';
      const budgetTotal = cf.budgetVersions[0]?.totalAmount ?? null;
      const companyPlaceholders = await this.getDocumentCompanyPlaceholders();

      const placeholders: Record<string, string> = {
        '{{dosya_no}}': cf.fileNo,
        '{{tarih}}': new Date().toLocaleDateString('tr-TR'),
        '{{sigorta_sirketi}}': cf.insuranceCompany?.name ?? '—',
        '{{hasar_nedeni}}': cf.lossType ?? '—',
        '{{police_no}}': cf.policyNo ?? '—',
        '{{hasar_no}}': cf.claimNo ?? '—',
        '{{sigorta_musteri_ad}}': insuredName || '—',
        '{{hasar_adresi}}': damageAddress || '—',
        '{{sigortali_ad}}': insuredName || '—',
        '{{sigortali_tc}}': cf.customer?.identityNo ?? '—',
        '{{sigortali_tazminat_bedeli}}': this.formatCurrency(budgetTotal),
        '{{sigortali_adres}}': damageAddress || '—',
        '{{magdur_ad}}': '—',
        '{{magdur_tc}}': '—',
        '{{magdur_konum}}': '—',
        '{{magdur_adres}}': '—',
        '{{onarim_bitis_tarihi}}': '… / … / ……',
        '{{tazminat_bedeli_toplam}}': this.formatCurrency(budgetTotal),
        ...companyPlaceholders,
      };

      const rendered = this.renderTemplate(MUVAFAKATNAME_TEMPLATE, placeholders);

      const publicToken = randomUUID();
      const publicTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      return this.prisma.fileDocument.create({
        data: {
          entityType: 'claim_file',
          entityId: dto.entityId,
          documentKind: 'muvafakatname',
          status: 'draft',
          renderedContent: rendered,
          publicToken,
          publicTokenExpiresAt,
          claimFileId: dto.entityId,
          createdByUserId,
        },
      });
    }

    if (dto.entityType === 'emergency_case') {
      const ec = await this.prisma.emergencyCase.findUnique({
        where: { id: dto.entityId },
        include: {
          assignedVendor: { select: { name: true, phone: true } },
          costEntries: { select: { amount: true, description: true, entryType: true } },
        },
      });
      if (!ec) throw new NotFoundException('Acil yardım vakası bulunamadı');

      // Müşteriye satış bedeli (gelir); alış/gider tutarı matbuya yazılmaz
      const gelirTotal = ec.costEntries
        .filter((c) => c.entryType === 'gelir')
        .reduce((s, c) => s + c.amount, 0);
      const toplamTutar = gelirTotal;

      const isOzeti = buildEmergencyMatbuWorkSummary(ec);

      const vendorName = (ec.assignedVendor?.name ?? '').trim();
      const vendorPhone = (ec.assignedVendor?.phone ?? '').trim();
      const tedarikci = vendorName
        ? vendorPhone
          ? `${toTitleCaseTR(vendorName)} · ${vendorPhone}`
          : toTitleCaseTR(vendorName)
        : '—';

      const musteriTelefon = (ec.customerPhone ?? '').trim() || '—';

      // İlçe / İl
      const ilceIl = [ec.district, ec.city].filter(Boolean).join(' / ') || '—';

      // Ayarlardan özel template varsa kullan
      const customTpl = await this.prisma.systemSetting.findUnique({
        where: { key: 'matbu_evrak_template' },
      });
      const sourceTpl = customTpl ? String((customTpl.value as any) ?? '') : MATBU_EVRAK_TEMPLATE;
      const companyPlaceholders = await this.getDocumentCompanyPlaceholders();

      const placeholders: Record<string, string> = {
        '{{case_no}}': ec.caseNo,
        '{{dosya_no}}': ec.fileNo ?? ec.caseNo,
        '{{tarih}}': new Date().toLocaleDateString('tr-TR'),
        '{{musteri_ad}}': toTitleCaseTR(ec.customerName) || ec.customerName,
        '{{musteri_telefon}}': musteriTelefon,
        '{{adres}}': ec.address,
        '{{ilce_il}}': ilceIl,
        '{{konu}}': toTitleCaseTR(ec.issueType) || ec.issueType,
        '{{tedarikci}}': tedarikci,
        '{{is_ozeti}}': isOzeti,
        '{{toplam_tutar}}': toplamTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 }),
        ...companyPlaceholders,
      };

      let rendered = sourceTpl;
      for (const [k, v] of Object.entries(placeholders)) {
        rendered = rendered.replaceAll(k, v);
      }

      const publicToken = randomUUID();
      const publicTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      return this.prisma.fileDocument.create({
        data: {
          entityType: 'emergency_case',
          entityId: dto.entityId,
          documentKind: 'matbu_evrak',
          status: 'draft',
          renderedContent: rendered,
          publicToken,
          publicTokenExpiresAt,
          emergencyCaseId: dto.entityId,
          createdByUserId,
        },
      });
    }

    throw new BadRequestException('Geçersiz entityType');
  }

  // ── Liste & Detay ─────────────────────────────────────────────────────────

  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.fileDocument.findMany({
      where: { entityType, entityId },
      select: {
        id: true,
        documentKind: true,
        status: true,
        publicToken: true,
        publicTokenExpiresAt: true,
        whatsappSentAt: true,
        whatsappPhone: true,
        viewedAt: true,
        digitallyApprovedAt: true,
        approvedFullName: true,
        physicalUploadKey: true,
        physicalUploadedAt: true,
        createdAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.fileDocument.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');
    return doc;
  }

  // ── WhatsApp Link ─────────────────────────────────────────────────────────

  async sendWhatsapp(id: string, dto: SendWhatsappDto) {
    const doc = await this.findOne(id);
    if (!doc.publicToken) throw new BadRequestException('Public token bulunamadı');

    const link = buildAppPath(this.config, `/evrak/${doc.publicToken}`);

    const kindLabel =
      doc.documentKind === 'muvafakatname' ? 'Muvafakatname' : 'Matbu Evrak';

    const message = encodeURIComponent(
      `Meridyen Assistance tarafından düzenlenen ${kindLabel} belgesini aşağıdaki linkten inceleyebilir ve onaylayabilirsiniz:\n\n${link}\n\nMeridyen Assistance`,
    );
    const waUrl = `https://wa.me/${dto.phone.replace(/\D/g, '')}?text=${message}`;

    await this.prisma.fileDocument.update({
      where: { id },
      data: {
        whatsappSentAt: new Date(),
        whatsappPhone: dto.phone,
        status: doc.status === 'draft' ? 'sent' : doc.status,
      },
    });

    return { waUrl, link };
  }

  // ── Fiziki Yükleme ────────────────────────────────────────────────────────

  async uploadPhysical(id: string, storageKey: string, uploadedByUserId: string) {
    const doc = await this.findOne(id);
    if (doc.documentKind !== 'muvafakatname') {
      throw new BadRequestException('Fiziki yükleme yalnızca muvafakatname için gereklidir');
    }
    return this.prisma.fileDocument.update({
      where: { id },
      data: {
        physicalUploadKey: storageKey,
        physicalUploadedAt: new Date(),
        physicalUploadedByUserId: uploadedByUserId,
        status: 'physically_uploaded',
      },
    });
  }

  // ── Public Token — Görüntüleme ────────────────────────────────────────────

  async findByToken(token: string) {
    const doc = await this.prisma.fileDocument.findUnique({
      where: { publicToken: token },
      select: {
        id: true,
        documentKind: true,
        status: true,
        renderedContent: true,
        digitallyApprovedAt: true,
        publicTokenExpiresAt: true,
      },
    });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');
    if (doc.publicTokenExpiresAt && doc.publicTokenExpiresAt < new Date()) {
      throw new BadRequestException('Bu evrak linkinin süresi dolmuştur');
    }
    return doc;
  }

  async markViewed(token: string, ip?: string) {
    const doc = await this.prisma.fileDocument.findUnique({
      where: { publicToken: token },
    });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');

    if (!doc.viewedAt) {
      await this.prisma.fileDocument.update({
        where: { publicToken: token },
        data: {
          viewedAt: new Date(),
          viewedIp: ip ?? null,
          status: doc.status === 'sent' || doc.status === 'draft' ? 'viewed' : doc.status,
        },
      });
    }
    return { success: true };
  }

  // ── Public Token — Dijital Onay ───────────────────────────────────────────

  async approveByToken(token: string, fullName: string, ip?: string) {
    const doc = await this.prisma.fileDocument.findUnique({
      where: { publicToken: token },
    });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');
    if (doc.publicTokenExpiresAt && doc.publicTokenExpiresAt < new Date()) {
      throw new BadRequestException('Bu evrak linkinin süresi dolmuştur');
    }
    if (doc.digitallyApprovedAt) {
      throw new BadRequestException('Bu evrak zaten onaylanmıştır');
    }

    const approvedAt = new Date();
    const signatureData = `accepted:${fullName}:${approvedAt.toISOString()}`;

    // İmzalı HTML ekle
    const signedBadge = `
      <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:12px">
        <strong style="color:#15803d">Dijital Onay</strong><br>
        <span style="color:#166534">${fullName}</span> tarafından 
        <span style="color:#166534">${approvedAt.toLocaleString('tr-TR')}</span> tarihinde onaylanmıştır.
        ${ip ? `<br><span style="color:#9ca3af;font-size:10px">IP: ${ip}</span>` : ''}
      </div>`;
    const updatedContent = doc.renderedContent.replace('</body>', `${signedBadge}</body>`);

    return this.prisma.fileDocument.update({
      where: { id: doc.id },
      data: {
        status: doc.documentKind === 'muvafakatname' ? 'digitally_approved' : 'digitally_approved',
        digitallyApprovedAt: approvedAt,
        approvedIp: ip ?? null,
        approvedFullName: fullName,
        signatureData,
        renderedContent: updatedContent,
      },
    });
  }

  // ── Kapama Koşulu Kontrolü (diğer servisler için) ──────────────────────────

  async checkClaimFileClosureConditions(claimFileId: string) {
    const docs = await this.prisma.fileDocument.findMany({
      where: { entityType: 'claim_file', entityId: claimFileId },
      orderBy: { createdAt: 'desc' },
    });

    const muvafakatname = docs.find((d) => d.documentKind === 'muvafakatname');

    const [repairReport, vendorContract] = await Promise.all([
      this.prisma.repairReport.findFirst({
        where: { claimFileId, status: 'approved' },
      }),
      this.prisma.vendorContract.findFirst({
        where: { claimFileId, status: 'vendor_signed' },
      }),
    ]);

    const conditions = {
      muvafakatnameDigitallyApproved: !!muvafakatname?.digitallyApprovedAt,
      muvafakatnamePhysicallyUploaded: !!muvafakatname?.physicalUploadKey,
      repairReportApproved: !!repairReport,
      vendorContractSigned: !!vendorContract,
    };

    return {
      ...conditions,
      canCreateInvoiceRequest:
        conditions.muvafakatnameDigitallyApproved &&
        conditions.repairReportApproved &&
        conditions.vendorContractSigned,
      muvafakatnameId: muvafakatname?.id ?? null,
      muvafakatnameStatus: muvafakatname?.status ?? null,
    };
  }

  async checkEmergencyCaseClosureConditions(emergencyCaseId: string) {
    const docs = await this.prisma.fileDocument.findMany({
      where: { entityType: 'emergency_case', entityId: emergencyCaseId },
      orderBy: { createdAt: 'desc' },
    });

    const matbuEvrak = docs.find((d) => d.documentKind === 'matbu_evrak');

    const ec = await this.prisma.emergencyCase.findUnique({
      where: { id: emergencyCaseId },
      select: { status: true },
    });

    const conditions = {
      matbuEvrakDigitallyApproved: !!matbuEvrak?.digitallyApprovedAt,
      caseStatusCompleted: ec?.status === 'COZULDU',
    };

    return {
      ...conditions,
      canCreateInvoiceRequest: Object.values(conditions).every(Boolean),
      matbuEvrakId: matbuEvrak?.id ?? null,
      matbuEvrakStatus: matbuEvrak?.status ?? null,
    };
  }
}
