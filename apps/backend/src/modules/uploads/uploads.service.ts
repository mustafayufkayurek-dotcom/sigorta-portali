import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { randomUUID } from 'crypto';
import { isSafeStorageKey } from '@/modules/storage/storage-path';
import { isFieldStaff } from '@/common/helpers/field-staff.helper';
import { normalizeRequestUser } from '@/common/helpers/claim-file-scope.helper';
import {
  assertScopedFileEntityAccess,
  fieldStaffMayDownloadEntityType,
  rethrowDownloadAccess,
  silentDocumentDownloadDeny,
} from '@/common/helpers/document-download-access';

@Injectable()
export class UploadsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  /**
   * Presigned URL oluştur — S3 ise gerçek presigned URL döner,
   * local ise mock URL döner (development).
   */
  async generatePresignedUrl(dto: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    ownerType: string;
    ownerId: string;
  }) {
    const uuid = randomUUID();
    const ext = dto.fileName.split('.').pop() ? `.${dto.fileName.split('.').pop()}` : '';
    const baseName = `${uuid}${ext}`;
    const storageKey = this.storage.buildKey(dto.ownerType, dto.ownerId, baseName);

    if (this.storage.isLocalProvider()) {
      // Development: mock presigned URL
      const presignedUrl = `http://localhost:3000/uploads/${storageKey}`;
      return { presignedUrl, storageKey, expiresIn: 3600 };
    }

    // Production: gerçek S3 presigned URL (PUT için ayrı endpoint)
    const presignedUrl = await this.storage.getSignedUrl(storageKey, 3600);
    return { presignedUrl, storageKey, expiresIn: 3600 };
  }

  /**
   * Yükleme tamamlandı — FileAsset kaydı oluştur.
   */
  async completeUpload(
    dto: {
      storageKey: string;
      fileName: string;
      fileExtension: string;
      mimeType: string;
      fileSize: number;
      ownerType: string;
      ownerId: string;
      category?: string;
    },
    userId: string,
  ) {
    return this.prisma.fileAsset.create({
      data: {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        fileName: dto.fileName,
        fileExtension: dto.fileExtension,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        storageKey: dto.storageKey,
        category: dto.category,
        uploadedByUserId: userId,
      },
    });
  }

  /**
   * FileAsset için signed URL döndür.
   */
  async getSignedUrl(storageKey: string, expiresIn = 900, user?: any): Promise<string> {
    await this.assertStorageKeyDownloadAccess(storageKey, user);
    return this.storage.getSignedUrl(storageKey, expiresIn);
  }

  async getFileBuffer(storageKey: string, user?: any): Promise<{ buffer: Buffer; mimeType: string }> {
    await this.assertStorageKeyDownloadAccess(storageKey, user);
    const buffer = await this.storage.download(storageKey);
    const lower = storageKey.toLowerCase();
    let mimeType = 'application/octet-stream';
    if (lower.endsWith('.webp')) mimeType = 'image/webp';
    else if (lower.endsWith('.png')) mimeType = 'image/png';
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (lower.endsWith('.gif')) mimeType = 'image/gif';
    else if (lower.endsWith('.pdf')) mimeType = 'application/pdf';
    return { buffer, mimeType };
  }

  private async assertStorageKeyDownloadAccess(storageKey: string, user?: any): Promise<void> {
    if (!isSafeStorageKey(storageKey)) {
      throw new BadRequestException('storageKey zorunlu');
    }
    const requestingUser = normalizeRequestUser(user);
    if (!requestingUser) silentDocumentDownloadDeny();

    const scopedUser = {
      ...requestingUser,
      insuranceCompanyScopes: user?.insuranceCompanyScopes,
      assistantCustomerScopes: user?.assistantCustomerScopes,
    };

    const entityDoc = await this.prisma.entityDocument.findFirst({
      where: { OR: [{ storageKey }, { thumbnailKey: storageKey }] },
      select: { entityType: true, entityId: true },
    });
    if (entityDoc) {
      await this.assertOwnedEntity(entityDoc.entityType, entityDoc.entityId, scopedUser);
      return;
    }

    const fileDoc = await this.prisma.fileDocument.findFirst({
      where: { physicalUploadKey: storageKey },
      select: { entityType: true, entityId: true },
    });
    if (fileDoc) {
      await this.assertOwnedEntity(fileDoc.entityType, fileDoc.entityId, scopedUser);
      return;
    }

    const asset = await this.prisma.fileAsset.findFirst({
      where: { OR: [{ storageKey }, { thumbnailKey: storageKey }] },
      select: { ownerType: true, ownerId: true },
    });
    if (asset) {
      await this.assertOwnedEntity(asset.ownerType, asset.ownerId, scopedUser);
      return;
    }

    const reportImage = await this.prisma.reportImage.findFirst({
      where: { OR: [{ storageKey }, { annotatedKey: storageKey }] },
      select: { report: { select: { claimFileId: true } } },
    });
    if (reportImage?.report?.claimFileId) {
      await this.assertOwnedEntity('claim_file', reportImage.report.claimFileId, scopedUser);
      return;
    }

    const inbound = await this.prisma.inboundAttachment.findFirst({
      where: { storageKey },
      select: {
        inboundMessage: {
          select: { claimFileId: true, emergencyCaseId: true },
        },
      },
    });
    if (inbound?.inboundMessage) {
      const { claimFileId, emergencyCaseId } = inbound.inboundMessage;
      if (claimFileId) {
        await this.assertOwnedEntity('claim_file', claimFileId, scopedUser);
        return;
      }
      if (emergencyCaseId) {
        await this.assertOwnedEntity('emergency_case', emergencyCaseId, scopedUser);
        return;
      }
      if (isFieldStaff(requestingUser.roleCode)) silentDocumentDownloadDeny();
      return;
    }

    const vendorDoc = await this.prisma.vendorDocument.findFirst({
      where: { OR: [{ storageKey }, { thumbnailKey: storageKey }] },
      select: { vendorId: true },
    });
    if (vendorDoc) {
      if (isFieldStaff(requestingUser.roleCode)) {
        const onEmergency = await this.prisma.emergencyCase.findFirst({
          where: {
            assignedVendorId: vendorDoc.vendorId,
            OR: [
              { assignedFieldUserId: requestingUser.id },
              { assignedUserId: requestingUser.id },
            ],
          },
          select: { id: true },
        });
        if (!onEmergency) silentDocumentDownloadDeny();
      }
      return;
    }

    const payment = await this.prisma.payment.findFirst({
      where: { receiptStorageKey: storageKey },
      select: { claimFileId: true },
    });
    if (payment?.claimFileId) {
      if (isFieldStaff(requestingUser.roleCode)) silentDocumentDownloadDeny();
      await this.assertOwnedEntity('claim_file', payment.claimFileId, scopedUser);
      return;
    }

    const cost = await this.prisma.emergencyCostEntry.findFirst({
      where: { receiptKey: storageKey },
      select: { caseId: true },
    });
    if (cost?.caseId) {
      await this.assertOwnedEntity('emergency_case', cost.caseId, scopedUser);
      return;
    }

    const hrDoc = await this.prisma.hrDocument.findFirst({
      where: { storageKey },
      select: { id: true },
    });
    if (hrDoc) {
      if (isFieldStaff(requestingUser.roleCode)) silentDocumentDownloadDeny();
      return;
    }

    silentDocumentDownloadDeny();
  }

  private async assertOwnedEntity(entityType: string, entityId: string, user: any): Promise<void> {
    const requestingUser = normalizeRequestUser(user);
    if (requestingUser && isFieldStaff(requestingUser.roleCode) && !fieldStaffMayDownloadEntityType(entityType)) {
      silentDocumentDownloadDeny();
    }
    try {
      await assertScopedFileEntityAccess(this.prisma, entityType, entityId, user);
    } catch (error) {
      rethrowDownloadAccess(error);
    }
  }
}
