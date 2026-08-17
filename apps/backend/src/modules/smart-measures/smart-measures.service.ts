import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { StorageService } from '@/modules/storage/storage.service';
import { ClaimFilesService } from '@/modules/claim-files/claim-files.service';
import { CreateSmartMeasureDto } from './dto/create-smart-measure.dto';
import { CreateSmartMeasureVersionDto } from './dto/create-smart-measure-version.dto';
import {
  areaMm2ToM2,
  computeAreaMm2,
  computePerimeterMm,
  computeVolumeMm3,
  mmToCm,
  mmToM,
  perimeterMmToM,
  resolveAiConfidenceLevel,
  volumeMm3ToM3,
} from './smart-measure-metrics';
import { detectSmartMeasureElementFromImage } from './smart-measure-detect.util';
import { buildSmartMeasureMetraj } from './smart-measure-metraj';
import { SmartMeasurePdfService } from './pdf/smart-measure-pdf.service';
import {
  SMART_MEASURE_ELEMENT_STATUSES,
  type SmartMeasureElementStatus,
} from './smart-measure-element-types';

type RequestUser = { id: string; email?: string | null; roleCode?: string };

@Injectable()
export class SmartMeasuresService {
  private readonly logger = new Logger(SmartMeasuresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly pdfService: SmartMeasurePdfService,
    private readonly claimFiles: ClaimFilesService,
  ) {}

  /** Tenant izolasyonu — ClaimFile üzerinden; bypass yok */
  private async assertTenantAccess(claimFileId: string, user: RequestUser) {
    if (!user.roleCode) {
      throw new BadRequestException('Kullanıcı rolü doğrulanamadı');
    }
    await this.claimFiles.findOne(claimFileId, {
      id: user.id,
      roleCode: user.roleCode,
    });
  }

  private parseMeasuredAt(raw?: string | null): Date {
    if (!raw) return new Date();
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  private derivedMetrics(widthMm?: number | null, heightMm?: number | null, depthMm?: number | null) {
    const areaMm2 = computeAreaMm2(widthMm, heightMm);
    const perimeterMm = computePerimeterMm(widthMm, heightMm);
    const volumeMm3 = computeVolumeMm3(widthMm, heightMm, depthMm);
    return {
      areaMm2,
      areaM2: areaMm2 != null ? areaMm2ToM2(areaMm2) : null,
      perimeterMm,
      perimeterM: perimeterMm != null ? perimeterMmToM(perimeterMm) : null,
      volumeMm3,
      volumeM3: volumeMm3 != null ? volumeMm3ToM3(volumeMm3) : null,
      display: {
        widthCm: widthMm != null ? mmToCm(widthMm) : null,
        heightCm: heightMm != null ? mmToCm(heightMm) : null,
        depthCm: depthMm != null ? mmToCm(depthMm) : null,
        widthM: widthMm != null ? mmToM(widthMm) : null,
        heightM: heightMm != null ? mmToM(heightMm) : null,
        depthM: depthMm != null ? mmToM(depthMm) : null,
      },
    };
  }

  private enrichVersion<T extends {
    widthMm?: number | null;
    heightMm?: number | null;
    depthMm?: number | null;
    photoFileAsset?: { id: string; storageKey: string } | null;
    annotatedPhotoFileAsset?: { id: string; storageKey: string } | null;
  }>(v: T | null) {
    if (!v) return null;
    const derived = this.derivedMetrics(v.widthMm, v.heightMm, v.depthMm);
    return {
      ...v,
      ...derived,
      photo: v.photoFileAsset
        ? { fileAssetId: v.photoFileAsset.id, storageKey: v.photoFileAsset.storageKey }
        : null,
      annotatedPhoto: v.annotatedPhotoFileAsset
        ? {
            fileAssetId: v.annotatedPhotoFileAsset.id,
            storageKey: v.annotatedPhotoFileAsset.storageKey,
          }
        : null,
    };
  }

  private versionInclude() {
    return {
      measuredBy: { select: { id: true, firstName: true, lastName: true } },
      photoFileAsset: { select: { id: true, storageKey: true, mimeType: true, fileName: true } },
      annotatedPhotoFileAsset: {
        select: { id: true, storageKey: true, mimeType: true, fileName: true },
      },
    } as const;
  }

  /** Domain event hazırlığı — şimdilik no-op / log; ileride Event Bus */
  private onSmartMeasureCreated(payload: Record<string, unknown>) {
    this.logger.debug(`SmartMeasureCreated ${JSON.stringify(payload)}`);
  }
  private onSmartMeasureRevised(payload: Record<string, unknown>) {
    this.logger.debug(`SmartMeasureRevised ${JSON.stringify(payload)}`);
  }
  private onSmartMeasureApproved(payload: Record<string, unknown>) {
    this.logger.debug(`SmartMeasureApproved ${JSON.stringify(payload)}`);
  }
  private onSmartMeasureArchived(payload: Record<string, unknown>) {
    this.logger.debug(`SmartMeasureArchived ${JSON.stringify(payload)}`);
  }

  async uploadPhoto(claimFileId: string, user: RequestUser, file: Express.Multer.File) {
    await this.assertTenantAccess(claimFileId, user);
    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const key = `smart-measures/${uuidv4()}.${ext}`;
    await this.storage.upload(file.buffer, key, file.mimetype);

    const fileAsset = await this.prisma.fileAsset.create({
      data: {
        ownerType: 'claim_file',
        ownerId: claimFileId,
        fileName: file.originalname || `measure.${ext}`,
        fileExtension: ext,
        mimeType: file.mimetype || 'image/jpeg',
        fileSize: file.size,
        storageKey: key,
        category: 'smart_measure',
        uploadedByUserId: user.id,
      },
    });

    const document = await this.prisma.claimDocument.create({
      data: {
        claimFileId,
        fileAssetId: fileAsset.id,
        documentType: 'smart_measure_photo',
      },
    });

    return { fileAssetId: fileAsset.id, documentId: document.id, storageKey: key };
  }

  async detectFromPhoto(claimFileId: string, user: RequestUser, file: Express.Multer.File) {
    await this.assertTenantAccess(claimFileId, user);
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    return detectSmartMeasureElementFromImage(file.buffer, file.mimetype, apiKey);
  }

  async create(claimFileId: string, user: RequestUser, dto: CreateSmartMeasureDto) {
    await this.assertTenantAccess(claimFileId, user);
    await this.assertFileAssetsBelongToClaim(claimFileId, [
      dto.photoFileAssetId,
      dto.annotatedPhotoFileAssetId,
    ]);

    const measuredAt = this.parseMeasuredAt(dto.measuredAt);
    const aiConfidenceLevel = resolveAiConfidenceLevel(dto.aiConfidence);
    const source = (dto.source?.trim() || 'mobile_ar').slice(0, 40);

    const created = await this.prisma.$transaction(async (tx) => {
      const element = await tx.smartMeasureElement.create({
        data: {
          claimFileId,
          createdByUserId: user.id,
          elementType: dto.elementType,
          title: dto.title.trim(),
          locationLabel: dto.locationLabel?.trim() || null,
          roomLabel: dto.roomLabel?.trim() || null,
          status: 'measured',
        },
      });

      await tx.smartMeasureVersion.create({
        data: {
          claimFileId,
          elementId: element.id,
          versionNo: 1,
          widthMm: dto.widthMm ?? null,
          heightMm: dto.heightMm ?? null,
          depthMm: dto.depthMm ?? null,
          quantity: dto.quantity ?? 1,
          aiConfidence: dto.aiConfidence ?? null,
          aiConfidenceLevel,
          aiDetectedType: dto.aiDetectedType?.trim() || null,
          isAiProduced: dto.isAiProduced ?? Boolean(dto.aiConfidence != null || dto.aiDetectedType),
          isUserCorrected: dto.isUserCorrected ?? false,
          isManualRevision: dto.isManualRevision ?? false,
          photoFileAssetId: dto.photoFileAssetId ?? null,
          annotatedPhotoFileAssetId: dto.annotatedPhotoFileAssetId ?? null,
          overlayJson: (dto.overlayJson ?? undefined) as Prisma.InputJsonValue | undefined,
          extensionJson: (dto.extensionJson ?? undefined) as Prisma.InputJsonValue | undefined,
          gpsLat: dto.gpsLat ?? null,
          gpsLng: dto.gpsLng ?? null,
          deviceInfoJson: (dto.deviceInfoJson ?? undefined) as Prisma.InputJsonValue | undefined,
          measuredAt,
          measuredByUserId: user.id,
          source,
          note: dto.note?.trim() || null,
        },
      });

      return element;
    });

    this.auditLogs.log({
      entityType: 'SmartMeasureElement',
      entityId: created.id,
      action: 'smart_measure.create',
      newValue: {
        claimFileId,
        elementType: dto.elementType,
        title: dto.title,
        versionNo: 1,
        widthMm: dto.widthMm,
        heightMm: dto.heightMm,
        depthMm: dto.depthMm,
        source,
      },
      userId: user.id,
      userEmail: user.email,
    });

    this.onSmartMeasureCreated({ claimFileId, elementId: created.id, versionNo: 1 });
    return this.getById(claimFileId, created.id, user);
  }

  private async assertFileAssetsBelongToClaim(
    claimFileId: string,
    assetIds: Array<string | null | undefined>,
  ) {
    const ids = assetIds.filter((id): id is string => Boolean(id?.trim()));
    for (const id of ids) {
      const asset = await this.prisma.fileAsset.findFirst({
        where: { id, ownerType: 'claim_file', ownerId: claimFileId },
        select: { id: true },
      });
      if (!asset) {
        throw new BadRequestException('Ölçüm fotoğrafı bu dosyaya ait değil');
      }
    }
  }

  async listByClaimFile(claimFileId: string, user: RequestUser) {
    await this.assertTenantAccess(claimFileId, user);
    const elements = await this.prisma.smartMeasureElement.findMany({
      where: { claimFileId, status: { not: 'archived' }, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
        versions: {
          orderBy: { versionNo: 'desc' },
          take: 1,
          include: this.versionInclude(),
        },
      },
    });

    return elements.map((el) => {
      const latestVersion = this.enrichVersion(el.versions[0] ?? null);
      const metraj = latestVersion
        ? buildSmartMeasureMetraj({
            elementType: el.elementType,
            widthMm: latestVersion.widthMm,
            heightMm: latestVersion.heightMm,
            depthMm: latestVersion.depthMm,
            quantity: latestVersion.quantity,
          })
        : [];
      return {
        ...el,
        latestVersion,
        metraj,
        versions: undefined,
      };
    });
  }

  async getById(claimFileId: string, elementId: string, user: RequestUser) {
    await this.assertTenantAccess(claimFileId, user);
    const element = await this.prisma.smartMeasureElement.findFirst({
      where: { id: elementId, claimFileId },
      include: {
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
        versions: {
          orderBy: { versionNo: 'asc' },
          include: this.versionInclude(),
        },
      },
    });
    if (!element) throw new NotFoundException('Akıllı ölçüm kaydı bulunamadı');

    const versions = element.versions.map((v) => this.enrichVersion(v)!);
    const latestVersion = versions[versions.length - 1] ?? null;
    const metraj = latestVersion
      ? buildSmartMeasureMetraj({
          elementType: element.elementType,
          widthMm: latestVersion.widthMm,
          heightMm: latestVersion.heightMm,
          depthMm: latestVersion.depthMm,
          quantity: latestVersion.quantity,
        })
      : [];
    return { ...element, versions, latestVersion, metraj };
  }

  async generatePdf(claimFileId: string, elementId: string, user: RequestUser) {
    const detail = await this.getById(claimFileId, elementId, user);
    const claim = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      include: { customer: { select: { fullName: true, companyName: true } } },
    });
    if (!claim) throw new NotFoundException('Hasar dosyası bulunamadı');

    const v = detail.latestVersion;
    if (!v) throw new NotFoundException('Ölçüm sürümü bulunamadı');

    const measuredByName = [v.measuredBy?.firstName, v.measuredBy?.lastName]
      .filter(Boolean)
      .join(' ');
    const photoKey =
      v.annotatedPhotoFileAsset?.storageKey ?? v.photoFileAsset?.storageKey ?? null;
    const photoDataUrl = await this.resolvePhotoDataUrlFromKey(photoKey);

    const buffer = await this.pdfService.generate({
      title: detail.title,
      elementType: detail.elementType,
      fileNo: claim.fileNo,
      claimNo: claim.claimNo,
      customerName: claim.customer?.fullName ?? claim.customer?.companyName ?? claim.insuredName,
      locationLabel: detail.locationLabel,
      roomLabel: detail.roomLabel,
      widthMm: v.widthMm,
      heightMm: v.heightMm,
      depthMm: v.depthMm,
      areaM2: v.areaM2,
      perimeterM: v.perimeterM,
      quantity: v.quantity,
      aiConfidence: v.aiConfidence,
      aiConfidenceLevel: v.aiConfidenceLevel,
      aiDetectedType: v.aiDetectedType,
      measuredAt: v.measuredAt,
      measuredByName: measuredByName || null,
      gpsLat: v.gpsLat,
      gpsLng: v.gpsLng,
      deviceInfo: (v.deviceInfoJson as Record<string, unknown> | null) ?? null,
      metraj: detail.metraj,
      photoDataUrl,
      versionNo: v.versionNo,
    });

    const safe = detail.title.replace(/[^\w\u00C0-\u024F\- ]+/g, '').trim().slice(0, 40) || 'olcum';
    return { buffer, filename: `akilli-olcum-${claim.fileNo}-${safe}.pdf` };
  }

  private async resolvePhotoDataUrlFromKey(key: string | null): Promise<string | null> {
    if (!key?.trim()) return null;
    try {
      const buf = await this.storage.download(key);
      const mime = this.mimeFromKey(key);
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch (err) {
      this.logger.warn(`Ölçüm fotoğrafı PDF'e alınamadı: ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  private mimeFromKey(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    return 'image/jpeg';
  }

  async addVersion(
    claimFileId: string,
    elementId: string,
    user: RequestUser,
    dto: CreateSmartMeasureVersionDto,
  ) {
    await this.assertTenantAccess(claimFileId, user);
    await this.assertFileAssetsBelongToClaim(claimFileId, [
      dto.photoFileAssetId,
      dto.annotatedPhotoFileAssetId,
    ]);

    const element = await this.prisma.smartMeasureElement.findFirst({
      where: { id: elementId, claimFileId, status: { not: 'archived' } },
      select: { id: true, status: true },
    });
    if (!element) throw new NotFoundException('Akıllı ölçüm kaydı bulunamadı');

    const last = await this.prisma.smartMeasureVersion.findFirst({
      where: { elementId, claimFileId },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true, widthMm: true, heightMm: true, depthMm: true },
    });
    const nextNo = (last?.versionNo ?? 0) + 1;
    const widthMm = dto.widthMm !== undefined ? dto.widthMm : last?.widthMm ?? null;
    const heightMm = dto.heightMm !== undefined ? dto.heightMm : last?.heightMm ?? null;
    const depthMm = dto.depthMm !== undefined ? dto.depthMm : last?.depthMm ?? null;
    const source = (dto.source?.trim() || 'manual').slice(0, 40);
    const aiConfidenceLevel = resolveAiConfidenceLevel(dto.aiConfidence);

    await this.prisma.$transaction(async (tx) => {
      await tx.smartMeasureVersion.create({
        data: {
          claimFileId,
          elementId,
          versionNo: nextNo,
          widthMm,
          heightMm,
          depthMm,
          quantity: dto.quantity ?? 1,
          aiConfidence: dto.aiConfidence ?? null,
          aiConfidenceLevel,
          aiDetectedType: dto.aiDetectedType?.trim() || null,
          isAiProduced: dto.isAiProduced ?? false,
          isUserCorrected: dto.isUserCorrected ?? true,
          isManualRevision: dto.isManualRevision ?? true,
          photoFileAssetId: dto.photoFileAssetId ?? null,
          annotatedPhotoFileAssetId: dto.annotatedPhotoFileAssetId ?? null,
          overlayJson: (dto.overlayJson ?? undefined) as Prisma.InputJsonValue | undefined,
          extensionJson: (dto.extensionJson ?? undefined) as Prisma.InputJsonValue | undefined,
          gpsLat: dto.gpsLat ?? null,
          gpsLng: dto.gpsLng ?? null,
          deviceInfoJson: (dto.deviceInfoJson ?? undefined) as Prisma.InputJsonValue | undefined,
          measuredAt: this.parseMeasuredAt(dto.measuredAt),
          measuredByUserId: user.id,
          source,
          note: dto.note?.trim() || null,
        },
      });

      if (element.status === 'draft') {
        await tx.smartMeasureElement.update({
          where: { id: elementId },
          data: { status: 'measured' },
        });
      }
    });

    this.auditLogs.log({
      entityType: 'SmartMeasureElement',
      entityId: elementId,
      action: 'smart_measure.revise',
      oldValue: { versionNo: last?.versionNo ?? null },
      newValue: { versionNo: nextNo, widthMm, heightMm, depthMm, source },
      userId: user.id,
      userEmail: user.email,
    });

    this.onSmartMeasureRevised({ claimFileId, elementId, versionNo: nextNo });
    return this.getById(claimFileId, elementId, user);
  }

  async updateStatus(
    claimFileId: string,
    elementId: string,
    user: RequestUser,
    status: SmartMeasureElementStatus,
  ) {
    await this.assertTenantAccess(claimFileId, user);
    if (!SMART_MEASURE_ELEMENT_STATUSES.includes(status)) {
      throw new BadRequestException('Geçersiz durum');
    }

    const element = await this.prisma.smartMeasureElement.findFirst({
      where: { id: elementId, claimFileId },
      select: { id: true, status: true },
    });
    if (!element) throw new NotFoundException('Akıllı ölçüm kaydı bulunamadı');

    const data: Prisma.SmartMeasureElementUpdateInput = { status };
    if (status === 'archived') {
      data.archivedAt = new Date();
      data.archivedByUser = { connect: { id: user.id } };
    } else if (element.status === 'archived') {
      data.archivedAt = null;
      data.archivedByUser = { disconnect: true };
    }

    await this.prisma.smartMeasureElement.update({ where: { id: elementId }, data });

    this.auditLogs.log({
      entityType: 'SmartMeasureElement',
      entityId: elementId,
      action: 'smart_measure.status',
      oldValue: { status: element.status },
      newValue: { status },
      userId: user.id,
      userEmail: user.email,
    });

    if (status === 'approved') {
      this.onSmartMeasureApproved({ claimFileId, elementId });
    }
    if (status === 'archived') {
      this.onSmartMeasureArchived({ claimFileId, elementId });
    }

    return this.getById(claimFileId, elementId, user);
  }

  async archive(claimFileId: string, elementId: string, user: RequestUser) {
    return this.updateStatus(claimFileId, elementId, user, 'archived');
  }
}
