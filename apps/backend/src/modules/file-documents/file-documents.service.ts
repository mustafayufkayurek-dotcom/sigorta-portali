import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { getDocumentBranding } from '@/common/utils/document-branding';
import {
  injectDigitalApprovalQrIntoHtml,
  renderDigitalApprovalQrBlock,
} from '@/common/utils/document-qr';
import { buildAppPath } from '@/common/utils/app-url';
import { buildWhatsAppMeUrl } from '@/common/utils/whatsapp-phone';
import { toTitleCaseTR } from '@/common/utils/text-helpers';
import { mapInboundLossTypeToMeridyen, canCreateHasarInvoiceRequest, isHasarVendorContractWaived, ACIL_ADRES_HIZMET_TALEP_KIND, ACIL_SERVIS_ONAY_KIND, acilDigitalFormTitle, isAcilDigitalFormKind, evaluatePublicApprovalToken, publicApprovalTokenErrorMessage, PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE } from '@sigorta/shared';
import { randomUUID } from 'crypto';
import {
  CreateFileDocumentDto,
  SendWhatsappDto,
} from './dto/file-documents.dto';
import { MUVAFAKATNAME_TEMPLATE } from './muvafakatname.template';
import { escHtml, escHtmlRecord } from '@/common/utils/html-escape';
import sharp from 'sharp';
import { StorageService } from '@/modules/storage/storage.service';
import { toInsuredFacingMatbuHtml } from './matbu-insured-view';
import {
  buildEmergencyMatbuPhotoHtml,
  buildEmergencyMatbuWorkSummary,
  buildEmergencyMatbuApprovalTrailHtml,
  EMERGENCY_MATBU_TEMPLATE,
  formatWorkSummaryHtml,
  meridyenLogoDataUri,
  resolveEmergencyMatbuIdentity,
  splitKdvHaric,
  HASAR_REPORT_PHOTO_BOX,
  isMatbuImageFile,
  applyEmergencyFormKind,
} from './emergency-matbu-form';
import {
  allowsClaimManualPhysicalKind,
  isClaimInsuredCatalogDocumentType,
  isDocumentTypeId,
} from '@/modules/document-types/document-type-scope';
import {
  isInsuranceCompanyUser,
  normalizeRequestUser,
} from '@/common/helpers/claim-file-scope.helper';
import { isFieldStaff } from '@/common/helpers/field-staff.helper';
import {
  assertScopedFileEntityAccess,
  fieldStaffMayDownloadEntityType,
  rethrowDownloadAccess,
} from '@/common/helpers/document-download-access';

@Injectable()
export class FileDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  private renderTemplate(template: string, placeholders: Record<string, string>): string {
    const safe = escHtmlRecord(placeholders);
    let rendered = template;
    for (const [key, value] of Object.entries(safe)) {
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

  private async loadEmergencyCaseForMatbu(id: string) {
    return this.prisma.emergencyCase.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            companyName: true,
            shortName: true,
            fullName: true,
            firstName: true,
            lastName: true,
            subType: true,
            phone: true,
          },
        },
        costEntries: { select: { amount: true, description: true, entryType: true } },
      },
    });
  }

  private async embedHasarReportPhoto(buf: Buffer): Promise<string | null> {
    try {
      const out = await sharp(buf)
        .rotate()
        .resize({
          width: HASAR_REPORT_PHOTO_BOX.width,
          height: HASAR_REPORT_PHOTO_BOX.height,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82 })
        .toBuffer();
      if (!out.length) return null;
      return `data:image/jpeg;base64,${out.toString('base64')}`;
    } catch {
      return null;
    }
  }

  private async buildEmergencyMatbuPhotoMarkup(entityId: string): Promise<string> {
    const [docs, inbound] = await Promise.all([
      this.prisma.entityDocument.findMany({
        where: { entityType: 'emergency_case', entityId },
        select: {
          fileName: true,
          mimeType: true,
          notes: true,
          storageKey: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.inboundAttachment.findMany({
        where: {
          inboundMessage: { emergencyCaseId: entityId },
          storageKey: { not: null },
        },
        select: {
          fileName: true,
          contentType: true,
          storageKey: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const entityImages = docs.filter((d) => isMatbuImageFile(d.mimeType, d.fileName));
    const tespit = entityImages.filter((d) => /tespit/i.test(d.notes ?? ''));
    const rest = entityImages.filter((d) => !/tespit/i.test(d.notes ?? ''));
    const inboxImages = inbound.filter((d) => isMatbuImageFile(d.contentType, d.fileName));
    const picked = [...tespit, ...rest, ...inboxImages];
    const photos: Array<{ dataUri: string; alt: string }> = [];
    for (const doc of picked) {
      const key = ('storageKey' in doc ? doc.storageKey : null) || '';
      if (!key) continue;
      try {
        const buf = await this.storage.download(key);
        if (!buf?.length) continue;
        const dataUri = await this.embedHasarReportPhoto(buf);
        if (!dataUri) continue;
        const name = (doc.fileName || 'Tespit').replace(/\.[^.]+$/, '');
        photos.push({ dataUri, alt: name });
      } catch {
        /* resim yok sayılır; form yine üretilir */
      }
    }
    return buildEmergencyMatbuPhotoHtml(photos);
  }

  private async renderEmergencyMatbuHtml(
    ec: NonNullable<Awaited<ReturnType<FileDocumentsService['loadEmergencyCaseForMatbu']>>>,
    publicUrl: string,
  ): Promise<string> {
    const gelirTotal = ec.costEntries
      .filter((c) => c.entryType === 'gelir')
      .reduce((s, c) => s + c.amount, 0);

    const identity = resolveEmergencyMatbuIdentity(ec);
    const kdvSplit = splitKdvHaric(gelirTotal);
    const konuLabel =
      mapInboundLossTypeToMeridyen(ec.issueType)
      ?? toTitleCaseTR(ec.issueType)
      ?? ec.issueType;

    const companyPlaceholders = await this.getDocumentCompanyPlaceholders();
    const embeddedLogo = meridyenLogoDataUri();
    const photoHtml = await this.buildEmergencyMatbuPhotoMarkup(ec.id);
    const qrBlock = renderDigitalApprovalQrBlock(publicUrl);
    const isOzetiHtml = formatWorkSummaryHtml(
      buildEmergencyMatbuWorkSummary({
        issueType: ec.issueType,
        notes: ec.notes,
        findingsText: ec.findingsText,
        costEntries: ec.costEntries,
      }),
    );

    const placeholders: Record<string, string> = {
      '{{case_no}}': ec.caseNo,
      '{{dosya_no}}': identity.dosyaNo,
      '{{tarih}}': new Date().toLocaleDateString('tr-TR'),
      '{{ana_musteri}}': identity.anaMusteri,
      '{{sigorta_sirketi}}': toTitleCaseTR(identity.sigortaSirketi) || identity.sigortaSirketi,
      '{{musteri_ad}}': toTitleCaseTR(identity.sigortaliAd) || identity.sigortaliAd,
      '{{musteri_telefon}}': identity.sigortaliTelefon,
      '{{adres}}': identity.sigortaliAdres,
      '{{konu}}': konuLabel,
      '{{is_ozeti}}': isOzetiHtml,
      '{{matrah}}': kdvSplit.matrah,
      '{{kdv}}': kdvSplit.kdv,
      '{{toplam_tutar}}': kdvSplit.toplam,
      '{{dosya_resimleri}}': photoHtml,
      '{{dijital_onay_izi}}': buildEmergencyMatbuApprovalTrailHtml({}),
      ...companyPlaceholders,
      '{{sirket_adres}}': '',
      '{{dijital_onay_qr}}': qrBlock,
      '{{logo_url}}': embeddedLogo,
    };

    let rendered = EMERGENCY_MATBU_TEMPLATE;
    const safePlaceholders = escHtmlRecord(
      placeholders,
      new Set(['{{dijital_onay_qr}}', '{{dosya_resimleri}}', '{{logo_url}}', '{{is_ozeti}}', '{{dijital_onay_izi}}']),
    );
    for (const [k, v] of Object.entries(safePlaceholders)) {
      rendered = rendered.replaceAll(k, v);
    }
    return injectDigitalApprovalQrIntoHtml(rendered, qrBlock);
  }

  private async renderEmergencyKindHtml(
    ec: NonNullable<Awaited<ReturnType<FileDocumentsService['loadEmergencyCaseForMatbu']>>>,
    publicUrl: string,
    kind: string,
  ): Promise<string> {
    const base = await this.renderEmergencyMatbuHtml(ec, publicUrl);
    return applyEmergencyFormKind(base, kind);
  }

  /** Onaysız taslak/gönderilmiş formu güncel şablonla yeniler. Onaylı kopyaya dokunulmaz. */
  private async refreshUnapprovedEmergencyMatbu<T extends {
    id: string;
    entityType: string;
    entityId: string;
    documentKind: string;
    digitallyApprovedAt: Date | null;
    publicToken: string | null;
    renderedContent: string;
  }>(doc: T): Promise<T> {
    if (!isAcilDigitalFormKind(doc.documentKind) || doc.entityType !== 'emergency_case') return doc;
    if (doc.digitallyApprovedAt || !doc.publicToken) return doc;
    const ec = await this.loadEmergencyCaseForMatbu(doc.entityId);
    if (!ec) return doc;
    const publicUrl = buildAppPath(this.config, `/evrak/${doc.publicToken}`);
    const rendered = await this.renderEmergencyKindHtml(ec, publicUrl, doc.documentKind);
    if (rendered === doc.renderedContent) return doc;
    await this.prisma.fileDocument.update({
      where: { id: doc.id },
      data: { renderedContent: rendered },
    });
    return { ...doc, renderedContent: rendered };
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
      const kind = dto.documentKind === ACIL_ADRES_HIZMET_TALEP_KIND
        ? ACIL_ADRES_HIZMET_TALEP_KIND
        : ACIL_SERVIS_ONAY_KIND;
      const existing = await this.prisma.fileDocument.findFirst({
        where: { entityType: 'emergency_case', entityId: dto.entityId, documentKind: kind },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return existing;

      const ec = await this.loadEmergencyCaseForMatbu(dto.entityId);
      if (!ec) throw new NotFoundException('Acil yardım vakası bulunamadı');

      const publicToken = randomUUID();
      const publicTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const publicUrl = buildAppPath(this.config, `/evrak/${publicToken}`);
      const rendered = await this.renderEmergencyKindHtml(ec, publicUrl, kind);

      return this.prisma.fileDocument.create({
        data: {
          entityType: 'emergency_case',
          entityId: dto.entityId,
          documentKind: kind,
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

  /** Dijital onay WhatsApp — dosyadaki sigortalı / müşteri telefonu */
  async resolveInsuredPhone(entityType: string, entityId: string): Promise<string> {
    if (entityType === 'claim_file') {
      const cf = await this.prisma.claimFile.findUnique({
        where: { id: entityId },
        select: { insuredPhone: true, customer: { select: { phone: true } } },
      });
      return (cf?.insuredPhone || cf?.customer?.phone || '').trim();
    }
    if (entityType === 'emergency_case') {
      const ec = await this.prisma.emergencyCase.findUnique({
        where: { id: entityId },
        select: { customerPhone: true },
      });
      return (ec?.customerPhone || '').trim();
    }
    return '';
  }

  // ── Liste & Detay ─────────────────────────────────────────────────────────

  private async assertViewerAccess(
    entityType: string,
    entityId: string,
    user?: {
      roleCode?: string;
      role?: { code?: string };
      insuranceCompanyScopes?: string[];
      assistantCustomerScopes?: string[];
    },
  ) {
    const normalized = normalizeRequestUser(user);
    if (!normalized) return;
    if (isInsuranceCompanyUser(normalized.roleCode) && entityType !== 'claim_file') {
      throw new ForbiddenException('Bu evraka erişim izniniz bulunmamaktadır');
    }
    if (isFieldStaff(normalized.roleCode) && !fieldStaffMayDownloadEntityType(entityType)) {
      throw new ForbiddenException('Bu evraka erişim izniniz bulunmamaktadır');
    }
    await assertScopedFileEntityAccess(this.prisma, entityType, entityId, {
      ...normalized,
      insuranceCompanyScopes: user?.insuranceCompanyScopes,
      assistantCustomerScopes: user?.assistantCustomerScopes,
    });
  }

  private async assertDownloadViewerAccess(
    entityType: string,
    entityId: string,
    user?: {
      roleCode?: string;
      role?: { code?: string };
      insuranceCompanyScopes?: string[];
      assistantCustomerScopes?: string[];
    },
  ) {
    try {
      await this.assertViewerAccess(entityType, entityId, user);
    } catch (error) {
      rethrowDownloadAccess(error);
    }
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    user?: { roleCode?: string; role?: { code?: string }; insuranceCompanyScopes?: string[] },
  ) {
    await this.assertViewerAccess(entityType, entityId, user);
    const [docs, suggestedPhone] = await Promise.all([
      this.prisma.fileDocument.findMany({
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
          renderedContent: true,
          createdAt: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.resolveInsuredPhone(entityType, entityId),
    ]);
    const catalogIds = [...new Set(docs.map((d) => d.documentKind).filter(isDocumentTypeId))];
    const catalogRows =
      catalogIds.length === 0
        ? []
        : await this.prisma.documentType.findMany({
            where: { id: { in: catalogIds } },
            select: { id: true, name: true },
          });
    const catalogName = new Map(catalogRows.map((r) => [r.id, r.name]));
    const hidePublicToken = Boolean(
      user && isInsuranceCompanyUser(normalizeRequestUser(user)?.roleCode ?? ''),
    );
    return docs.map((d) => {
      const { renderedContent, publicToken, publicTokenExpiresAt, ...rest } = d;
      return {
        ...rest,
        publicToken: hidePublicToken ? null : publicToken,
        publicTokenExpiresAt: hidePublicToken ? null : publicTokenExpiresAt,
        suggestedPhone: hidePublicToken ? '' : suggestedPhone,
        documentTypeName: catalogName.get(d.documentKind) ?? null,
        canPreview: Boolean(d.physicalUploadKey || renderedContent),
      };
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

    const phone =
      (dto.phone ?? '').trim() ||
      (await this.resolveInsuredPhone(doc.entityType, doc.entityId));
    if (!phone) {
      throw new BadRequestException('Sigortalı telefon numarası bulunamadı');
    }

    const link = buildAppPath(this.config, `/evrak/${doc.publicToken}`);

    const kindLabel =
      doc.documentKind === 'muvafakatname' ? 'Muvafakatname' : acilDigitalFormTitle(doc.documentKind);

    const message =
      isAcilDigitalFormKind(doc.documentKind)
        ? `Meridyen Assistance ${kindLabel}. Yazıcı gerekmez. Aşağıdaki linki telefondan açıp Onayla’ya basın:\n\n${link}\n\nMeridyen Assistance`
        : `Meridyen Assistance tarafından düzenlenen ${kindLabel} belgesini aşağıdaki linkten inceleyebilir ve onaylayabilirsiniz:\n\n${link}\n\nMeridyen Assistance`;
    const waUrl = buildWhatsAppMeUrl(phone, message);
    if (!waUrl) {
      throw new BadRequestException('Geçerli bir WhatsApp telefon numarası giriniz');
    }

    await this.prisma.fileDocument.update({
      where: { id },
      data: {
        whatsappSentAt: new Date(),
        whatsappPhone: phone,
        status: doc.status === 'draft' ? 'sent' : doc.status,
      },
    });

    return { waUrl, link, message, phone };
  }

  // ── Fiziki Yükleme ────────────────────────────────────────────────────────

  async uploadPhysical(id: string, storageKey: string, uploadedByUserId: string) {
    const doc = await this.findOne(id);
    if (!allowsClaimManualPhysicalKind(doc.documentKind)) {
      throw new BadRequestException('Bu evrak türüne fiziki yükleme yapılamaz');
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

  /** Dosya Sorumlusu — tür Tanımlar → Evrak Türleri (Müşteri · Sigortalı) */
  async uploadManualForClaim(
    claimFileId: string,
    documentTypeId: string,
    file: Express.Multer.File,
    uploadedByUserId: string,
  ) {
    const cf = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: { id: true },
    });
    if (!cf) throw new NotFoundException('Hasar dosyası bulunamadı');
    if (!file?.buffer?.length) {
      throw new BadRequestException('Dosya seçilmedi veya okunamadı');
    }

    const catalog = await this.prisma.documentType.findUnique({
      where: { id: documentTypeId },
    });
    if (!catalog || !isClaimInsuredCatalogDocumentType(catalog)) {
      throw new BadRequestException(
        'Bu evrak türü Tanımlar Merkezi’nde Müşteri · Sigortalı kapsamında tanımlı değil.',
      );
    }

    const documentKind = catalog.id;
    let doc = await this.prisma.fileDocument.findFirst({
      where: { entityType: 'claim_file', entityId: claimFileId, documentKind },
      orderBy: { createdAt: 'desc' },
    });

    if (!doc) {
      doc = await this.prisma.fileDocument.create({
        data: {
          entityType: 'claim_file',
          entityId: claimFileId,
          documentKind,
          status: 'draft',
          renderedContent: `<p>Manuel yüklenen evrak: ${catalog.name}</p>`,
          claimFileId,
          createdByUserId: uploadedByUserId,
        },
      });
    }

    const safeName = (file.originalname || 'evrak').replace(/[^\w.\-ğüşıöçĞÜŞİÖÇ ]+/g, '_');
    const result = await this.storage.upload(
      file.buffer,
      `file-documents/${doc.id}/${safeName}`,
      file.mimetype,
    );
    return this.uploadPhysical(doc.id, result.key, uploadedByUserId);
  }

  async getPhysicalFileBuffer(
    id: string,
    user?: { roleCode?: string; role?: { code?: string }; insuranceCompanyScopes?: string[] },
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }> {
    const doc = await this.findOne(id);
    await this.assertDownloadViewerAccess(doc.entityType, doc.entityId, user);
    if (!doc.physicalUploadKey) {
      throw new NotFoundException('Yüklenmiş evrak dosyası yok');
    }
    const buffer = await this.storage.download(doc.physicalUploadKey);
    const fileName = doc.physicalUploadKey.split('/').pop() || 'evrak';
    const lower = fileName.toLowerCase();
    const mimeType = lower.endsWith('.pdf')
      ? 'application/pdf'
      : lower.endsWith('.png')
        ? 'image/png'
        : /\.jpe?g$/.test(lower)
          ? 'image/jpeg'
          : lower.endsWith('.webp')
            ? 'image/webp'
            : lower.endsWith('.gif')
              ? 'image/gif'
              : 'application/octet-stream';
    return { buffer, fileName, mimeType };
  }

  /** Oturumla görüntü / yazdır: fiziki bayt veya dijital HTML (muvafakat). MinIO 302 yok. */
  async getStaffViewBuffer(
    id: string,
    user?: { roleCode?: string; role?: { code?: string }; insuranceCompanyScopes?: string[] },
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }> {
    const doc = await this.findOne(id);
    await this.assertDownloadViewerAccess(doc.entityType, doc.entityId, user);
    if (doc.physicalUploadKey) {
      return this.getPhysicalFileBuffer(id, user);
    }
    if (doc.renderedContent?.trim()) {
      const fresh = await this.refreshUnapprovedEmergencyMatbu(doc);
      const html =
        isAcilDigitalFormKind(fresh.documentKind)
          ? toInsuredFacingMatbuHtml(fresh.renderedContent)
          : fresh.renderedContent;
      const fileName =
        doc.documentKind === 'muvafakatname' ? 'muvafakatname.html' : 'evrak.html';
      return {
        buffer: Buffer.from(html, 'utf8'),
        fileName,
        mimeType: 'text/html; charset=utf-8',
      };
    }
    throw new NotFoundException('Görüntülenecek evrak yok');
  }

  // ── Public Token — Görüntüleme ────────────────────────────────────────────

  async findByToken(token: string) {
    const doc = await this.prisma.fileDocument.findUnique({
      where: { publicToken: token },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        documentKind: true,
        status: true,
        renderedContent: true,
        digitallyApprovedAt: true,
        publicToken: true,
        publicTokenExpiresAt: true,
        createdAt: true,
      },
    });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');
    const tokenGate = evaluatePublicApprovalToken(doc);
    if (!tokenGate.ok) {
      throw new BadRequestException(
        tokenGate.reason === 'closed'
          ? PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE
          : publicApprovalTokenErrorMessage(tokenGate.reason, 'evrak'),
      );
    }
    const fresh = await this.refreshUnapprovedEmergencyMatbu(doc);
    let expectedFullName: string | null = null;
    if (fresh.entityType === 'emergency_case') {
      const ec = await this.loadEmergencyCaseForMatbu(fresh.entityId);
      if (ec) {
        const ad = resolveEmergencyMatbuIdentity(ec).sigortaliAd.trim();
        expectedFullName = !ad || ad === '—' ? null : ad;
      }
    }
    const { publicToken: _token, createdAt: _issuedAt, ...publicDoc } = fresh;
    if (isAcilDigitalFormKind(fresh.documentKind) && fresh.renderedContent) {
      return {
        ...publicDoc,
        renderedContent: toInsuredFacingMatbuHtml(fresh.renderedContent),
        expectedFullName,
      };
    }
    return { ...publicDoc, expectedFullName };
  }

  async markViewed(token: string, ip?: string) {
    const doc = await this.prisma.fileDocument.findUnique({
      where: { publicToken: token },
    });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');
    const tokenGate = evaluatePublicApprovalToken(doc);
    if (!tokenGate.ok) {
      throw new BadRequestException(
        tokenGate.reason === 'closed'
          ? PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE
          : publicApprovalTokenErrorMessage(tokenGate.reason, 'evrak'),
      );
    }

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
    const tokenGate = evaluatePublicApprovalToken(doc);
    if (!tokenGate.ok) {
      throw new BadRequestException(
        tokenGate.reason === 'closed'
          ? PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE
          : publicApprovalTokenErrorMessage(tokenGate.reason, 'evrak'),
      );
    }

    const approvedAt = new Date();
    const signatureData = `accepted:${fullName}:${approvedAt.toISOString()}`;

    let updatedContent = doc.renderedContent;
    if (doc.documentKind === 'matbu_evrak') {
      const trail = buildEmergencyMatbuApprovalTrailHtml({
        approvedFullName: fullName,
        approvedAt,
        ip: ip ?? null,
      });
      if (updatedContent.includes('data-testid="dijital-onay-izi"')) {
        updatedContent = updatedContent.replace(
          /(<div class="approval-trail-section" data-testid="dijital-onay-izi">)[\s\S]*?(<div class="report-footer")/,
          `$1${trail}\n$2`,
        );
      } else {
        updatedContent = updatedContent.replace('</body>', `${trail}</body>`);
      }
    } else {
      const signedBadge = `
      <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:12px">
        <strong style="color:#15803d">Dijital Onay</strong><br>
        <span style="color:#166534">${escHtml(fullName)}</span> tarafından 
        <span style="color:#166534">${escHtml(approvedAt.toLocaleString('tr-TR'))}</span> tarihinde onaylanmıştır.
        ${ip ? `<br><span style="color:#9ca3af;font-size:10px">IP: ${escHtml(ip)}</span>` : ''}
      </div>`;
      updatedContent = doc.renderedContent.replace('</body>', `${signedBadge}</body>`);
    }

    const closed = await this.prisma.fileDocument.updateMany({
      where: {
        id: doc.id,
        digitallyApprovedAt: null,
        status: { notIn: ['digitally_approved', 'rejected', 'digitally_rejected'] },
      },
      data: {
        status: 'digitally_approved',
        digitallyApprovedAt: approvedAt,
        approvedIp: ip ?? null,
        approvedFullName: fullName,
        signatureData,
        renderedContent: updatedContent,
      },
    });
    if (closed.count !== 1) {
      throw new BadRequestException(PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE);
    }
    return { digitallyApprovedAt: approvedAt.toISOString(), status: 'digitally_approved' };
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

    const waived = isHasarVendorContractWaived({ id: claimFileId });
    const conditions = {
      muvafakatnameDigitallyApproved: !!muvafakatname?.digitallyApprovedAt,
      muvafakatnamePhysicallyUploaded: !!muvafakatname?.physicalUploadKey,
      repairReportApproved: !!repairReport,
      vendorContractSigned: !!vendorContract || waived,
      vendorContractWaived: waived,
    };

    return {
      ...conditions,
      canCreateInvoiceRequest: canCreateHasarInvoiceRequest({
        muvafakatnameDigitallyApproved: conditions.muvafakatnameDigitallyApproved,
        repairReportApproved: conditions.repairReportApproved,
      }),
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
      caseStatusCompleted: ec?.status === 'COZULDU' || ec?.status === 'FATURALANDILDI',
    };

    return {
      ...conditions,
      canCreateInvoiceRequest: conditions.caseStatusCompleted,
      matbuEvrakId: matbuEvrak?.id ?? null,
      matbuEvrakStatus: matbuEvrak?.status ?? null,
    };
  }
}
