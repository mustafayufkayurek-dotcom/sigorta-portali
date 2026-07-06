import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { extractFieldSurveyFieldsFromImage } from './field-survey-scan.util';
import { FieldSurveyScanResult } from './field-survey-scan.types';
import { CreateFieldSurveyBriefDto } from './dto/create-field-survey-brief.dto';
import { FieldSurveyPdfService } from './pdf/field-survey-pdf.service';

@Injectable()
export class FieldSurveyBriefsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly pdfService: FieldSurveyPdfService,
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
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!brief) throw new NotFoundException('Keşif ölçüsü bulunamadı');
    return brief;
  }

  async generatePdf(claimFileId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const brief = await this.findOne(claimFileId, id);
    const cf = brief.claimFile;
    const addr = cf.propertyAddress
      ? [
          cf.propertyAddress.addressLine,
          cf.propertyAddress.district,
          cf.propertyAddress.city,
        ]
          .filter(Boolean)
          .join(', ')
      : null;

    const buffer = await this.pdfService.generate({
      title: brief.title,
      itemType: brief.itemType,
      summaryText: brief.summaryText,
      fileNo: cf.fileNo,
      claimNo: cf.claimNo,
      customerName: cf.customer?.fullName ?? cf.customer?.companyName ?? null,
      address: addr,
      dimensions: brief.dimensionsJson as any[],
      materials: brief.materialsJson as any[],
      aiConfidence: brief.aiConfidence,
      createdAt: brief.createdAt,
    });

    const safeTitle = brief.title.replace(/[^\w\u00C0-\u024F\s-]/g, '').trim().slice(0, 40) || 'kesif-olcusu';
    return {
      buffer,
      filename: `tahmini-kesif-olcusu-${cf.fileNo}-${safeTitle}.pdf`,
    };
  }

  async getSharePayload(claimFileId: string, id: string, phone?: string) {
    const brief = await this.findOne(claimFileId, id);
    const apiBase =
      this.config.get<string>('BACKEND_URL') ??
      this.config.get<string>('API_PUBLIC_URL') ??
      'http://localhost:3000';
    const pdfUrl = `${apiBase.replace(/\/+$/, '')}/api/v1/claim-files/${claimFileId}/field-survey-briefs/${id}/pdf`;

    const summaryText = this.buildShareSummary(brief);
    const whatsappUrl = this.buildWhatsAppUrl(summaryText, pdfUrl, phone);

    return { pdfUrl, whatsappUrl, summaryText };
  }

  private buildShareSummary(brief: {
    title: string;
    summaryText: string;
    claimFile: { fileNo: string };
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

    const lines = [
      `*Tahmini Keşif Ölçüsü* — ${brief.claimFile.fileNo}`,
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
