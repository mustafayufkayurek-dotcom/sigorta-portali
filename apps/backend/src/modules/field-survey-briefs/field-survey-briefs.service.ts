import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { extractFieldSurveyFieldsFromImage } from './field-survey-scan.util';
import { FieldSurveyScanResult } from './field-survey-scan.types';
import { CreateFieldSurveyBriefDto } from './dto/create-field-survey-brief.dto';
import {
  FieldSurveyPdfService,
  type FieldSurveyPdfVariant,
} from './pdf/field-survey-pdf.service';

@Injectable()
export class FieldSurveyBriefsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly pdfService: FieldSurveyPdfService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async scanPhoto(
    claimFileId: string,
    file: Express.Multer.File,
  ): Promise<FieldSurveyScanResult> {
    await this.assertClaimFileExists(claimFileId);
    const photoUrl = await this.uploadPhoto(file);
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const extracted = await extractFieldSurveyFieldsFromImage(file.buffer, file.mimetype, apiKey);

    return {
      configured: extracted.configured,
      itemType: extracted.itemType,
      title: extracted.title,
      summaryText: extracted.summaryText,
      dimensions: extracted.dimensions,
      materials: extracted.materials,
      aiConfidence: extracted.aiConfidence,
      photoUrl,
      message: extracted.message,
    };
  }

  async create(
    claimFileId: string,
    userId: string,
    dto: CreateFieldSurveyBriefDto,
  ) {
    await this.assertClaimFileExists(claimFileId);

    const brief = await this.prisma.fieldSurveyBrief.create({
      data: {
        claimFileId,
        createdByUserId: userId,
        itemType: dto.itemType,
        title: dto.title.trim(),
        summaryText: dto.summaryText.trim(),
        dimensionsJson: dto.dimensions as unknown as Prisma.InputJsonValue,
        materialsJson: dto.materials as unknown as Prisma.InputJsonValue,
        aiConfidence: dto.aiConfidence ?? null,
        isEstimated: dto.isEstimated ?? true,
        photoUrl: dto.photoUrl ?? null,
        annotatedPhotoUrl: dto.annotatedPhotoUrl ?? null,
        status: dto.status ?? 'draft',
      },
      include: {
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return brief;
  }

  async listByClaimFile(claimFileId: string) {
    await this.assertClaimFileExists(claimFileId);
    return this.prisma.fieldSurveyBrief.findMany({
      where: { claimFileId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findOne(claimFileId: string, id: string) {
    const brief = await this.prisma.fieldSurveyBrief.findFirst({
      where: { id, claimFileId },
      include: {
        claimFile: {
          include: {
            customer: true,
            propertyAddress: true,
            insuranceCompany: { select: { name: true } },
          },
        },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
      },
    });
    if (!brief) throw new NotFoundException('Keşif ölçüsü bulunamadı');
    return brief;
  }

  async remove(
    claimFileId: string,
    id: string,
    user: { id: string; email?: string | null },
  ) {
    const brief = await this.findOne(claimFileId, id);
    await this.prisma.fieldSurveyBrief.delete({ where: { id: brief.id } });

    for (const url of [brief.photoUrl, brief.annotatedPhotoUrl]) {
      const key = url ? this.extractStorageKey(url) : null;
      if (key) {
        try {
          await this.storage.delete(key);
        } catch {
          /* dosya yoksa sessiz geç */
        }
      }
    }

    this.auditLogs.log({
      entityType: 'FieldSurveyBrief',
      entityId: brief.id,
      action: 'DELETE',
      oldValue: {
        claimFileId,
        title: brief.title,
        itemType: brief.itemType,
      },
      userId: user.id,
      userEmail: user.email ?? null,
    });

    return { id: brief.id, deleted: true };
  }

  async generatePdf(
    claimFileId: string,
    id: string,
    variant: FieldSurveyPdfVariant = 'internal',
  ): Promise<{ buffer: Buffer; filename: string }> {
    const brief = await this.findOne(claimFileId, id);
    const cf = brief.claimFile;
    const isSupplier = variant === 'supplier';
    const addr =
      !isSupplier && cf.propertyAddress
        ? [
            cf.propertyAddress.addressLine,
            cf.propertyAddress.district,
            cf.propertyAddress.city,
          ]
            .filter(Boolean)
            .join(', ')
        : null;

    const expertName = !isSupplier
      ? [brief.createdByUser?.firstName, brief.createdByUser?.lastName].filter(Boolean).join(' ') ||
        null
      : null;

    const photoDataUrl = await this.resolvePhotoDataUrl(
      brief.annotatedPhotoUrl ?? brief.photoUrl,
    );

    // Supplier: Sigortalı Adı Soyadı; telefon/e-posta/adres/eksper/dosya/poliçe ASLA
    const customerDisplayName =
      cf.customer?.fullName ?? cf.customer?.companyName ?? null;

    const buffer = await this.pdfService.generate(
      {
        title: brief.title,
        itemType: brief.itemType,
        summaryText: brief.summaryText,
        fileNo: cf.fileNo,
        claimNo: isSupplier ? null : cf.claimNo,
        policyNo: isSupplier ? null : (cf.policyNo ?? null),
        customerName: customerDisplayName,
        customerPhone: isSupplier
          ? null
          : (cf.insuredPhone ?? cf.customer?.phone ?? null),
        customerEmail: isSupplier ? null : (cf.customer?.email ?? null),
        address: addr,
        expertName,
        expertPhone: isSupplier ? null : (brief.createdByUser?.phone ?? null),
        expertEmail: isSupplier ? null : (brief.createdByUser?.email ?? null),
        dimensions: brief.dimensionsJson as any[],
        materials: brief.materialsJson as any[],
        aiConfidence: isSupplier ? null : brief.aiConfidence,
        createdAt: brief.createdAt,
        photoDataUrl,
      },
      variant,
    );

    const safeTitle =
      brief.title.replace(/[^\w\u00C0-\u024F\s-]/g, '').trim().slice(0, 40) || 'kesif-olcusu';
    const prefix = isSupplier ? 'tedarikci-kesif-olcusu' : 'tahmini-kesif-olcusu';
    return {
      buffer,
      filename: `${prefix}-${cf.fileNo}-${safeTitle}.pdf`,
    };
  }

  async getSharePayload(claimFileId: string, id: string, phone?: string) {
    const brief = await this.findOne(claimFileId, id);
    const apiBase =
      this.config.get<string>('BACKEND_URL') ??
      this.config.get<string>('API_PUBLIC_URL') ??
      'http://localhost:3000';
    // WhatsApp / tedarikçi paylaşımı — supplier PDF (ad var; iletişim/adres yok)
    const pdfUrl = `${apiBase.replace(/\/+$/, '')}/api/v1/claim-files/${claimFileId}/field-survey-briefs/${id}/pdf?variant=supplier`;

    const summaryText = this.buildShareSummary(brief);
    const whatsappUrl = this.buildWhatsAppUrl(summaryText, pdfUrl, phone);

    return { pdfUrl, whatsappUrl, summaryText, variant: 'supplier' as const };
  }

  /** Storage URL → PDF embed için data URI; başarısızsa null (PDF yine üretilir). */
  private async resolvePhotoDataUrl(photoUrl: string | null | undefined): Promise<string | null> {
    if (!photoUrl?.trim()) return null;
    const key = this.extractStorageKey(photoUrl);
    if (!key) return null;
    try {
      const buf = await this.storage.download(key);
      const ext = key.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime =
        ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }

  private extractStorageKey(photoUrl: string): string | null {
    const trimmed = photoUrl.trim();
    if (trimmed.startsWith('field-survey-briefs/')) return trimmed;
    const uploadsMatch = trimmed.match(/\/uploads\/(.+)$/);
    if (uploadsMatch?.[1]) return uploadsMatch[1];
    const fsbMatch = trimmed.match(/(field-survey-briefs\/[^?#]+)/);
    if (fsbMatch?.[1]) return fsbMatch[1];
    return null;
  }

  private buildShareSummary(brief: {
    title: string;
    summaryText: string;
    dimensionsJson: unknown;
  }): string {
    const dims = Array.isArray(brief.dimensionsJson) ? brief.dimensionsJson : [];
    const dimLines = dims
      .slice(0, 4)
      .map((d: any) => {
        const parts = [
          d.genislikCm != null ? `G:${d.genislikCm}` : null,
          d.yukseklikCm != null ? `Y:${d.yukseklikCm}` : null,
          d.derinlikCm != null ? `D:${d.derinlikCm}` : null,
        ].filter(Boolean);
        return parts.length ? `${d.label ?? 'Alan'} (${parts.join(' ')} cm tahmini)` : null;
      })
      .filter(Boolean)
      .join('; ');

    // Tedarikçi mesajı — dosya/hasar no yok
    const lines = [
      '*Tahmini Keşif Ölçüsü*',
      brief.title,
      brief.summaryText,
      dimLines ? `Ölçüler: ${dimLines}` : null,
      'PDF: aşağıdaki bağlantıdan indirilebilir.',
    ].filter(Boolean);

    return lines.join('\n');
  }

  private buildWhatsAppUrl(summaryText: string, pdfUrl: string, phone?: string): string {
    const message = `${summaryText}\n\n${pdfUrl}`;
    const recipient = phone ? `90${phone.replace(/\D/g, '')}` : '';
    return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
  }

  private async uploadPhoto(file: Express.Multer.File): Promise<string> {
    const ext = file.originalname.split('.').pop() || 'jpg';
    const key = `field-survey-briefs/${uuidv4()}.${ext}`;
    const result = await this.storage.upload(file.buffer, key, file.mimetype);
    return result.url;
  }

  private async assertClaimFileExists(claimFileId: string) {
    const exists = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Hasar dosyası bulunamadı');
  }
}
