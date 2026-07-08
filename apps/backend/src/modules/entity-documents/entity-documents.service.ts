import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { ImageOptimizerService } from '@/modules/storage/image-optimizer.service';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  assertClaimFileAccess,
  isInsuranceCompanyUser,
  normalizeRequestUser,
} from '@/common/helpers/claim-file-scope.helper';
import { isFieldStaff } from '@/common/helpers/field-staff.helper';

@Injectable()
export class EntityDocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private imageOptimizer: ImageOptimizerService,
  ) {}

  private async assertEntityAccess(
    entityType: string,
    entityId: string,
    user?: any,
    insuranceCompanyIds?: string[],
  ): Promise<void> {
    const requestingUser = normalizeRequestUser(user);
    if (!requestingUser) return;

    if (entityType === 'customer') {
      if (isFieldStaff(requestingUser.roleCode)) {
        const assigned = await this.prisma.claimFile.findFirst({
          where: { customerId: entityId, assignedFieldUserId: requestingUser.id },
          select: { id: true },
        });
        if (!assigned) {
          throw new ForbiddenException('Bu müşteriye erişim izniniz bulunmamaktadır');
        }
      }
      if (isInsuranceCompanyUser(requestingUser.roleCode) && insuranceCompanyIds?.length) {
        const linked = await this.prisma.claimFile.findFirst({
          where: {
            customerId: entityId,
            insuranceCompanyId: { in: insuranceCompanyIds },
          },
          select: { id: true },
        });
        if (!linked) {
          throw new ForbiddenException('Bu müşteriye erişim izniniz bulunmamaktadır');
        }
      }
      return;
    }

    if (entityType === 'claim_file' || entityType === 'claim-file') {
      const claimFile = await this.prisma.claimFile.findUnique({
        where: { id: entityId },
        select: {
          insuranceCompanyId: true,
          assignedFieldUserId: true,
          closedAt: true,
        },
      });
      if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');
      assertClaimFileAccess(claimFile, requestingUser, insuranceCompanyIds);
    }
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    user?: any,
    insuranceCompanyIds?: string[],
  ) {
    await this.assertEntityAccess(entityType, entityId, user, insuranceCompanyIds);
    const data = await this.prisma.entityDocument.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: {
        documentType: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return { data };
  }

  async create(params: {
    file: Express.Multer.File;
    entityType: string;
    entityId: string;
    documentTypeId?: string;
    notes?: string;
    uploadedByUserId: string;
    requestingUser?: any;
    insuranceCompanyIds?: string[];
  }) {
    const { file, entityType, entityId, documentTypeId, notes, uploadedByUserId, requestingUser, insuranceCompanyIds } = params;
    await this.assertEntityAccess(entityType, entityId, requestingUser, insuranceCompanyIds);
    const isImage = this.imageOptimizer.isImage(file.mimetype);
    const uuid = randomUUID();

    let storageKey: string;
    let thumbnailKey: string | null = null;
    let mimeType = file.mimetype;
    let fileSize = file.size;

    if (isImage) {
      // Optimize et → WebP
      const { buffer: optimized, mimeType: optimizedMime, extension } =
        await this.imageOptimizer.optimizeImage(file.buffer);

      const baseName = `${uuid}-optimized${extension}`;
      storageKey = this.storage.buildKey(entityType, entityId, baseName);
      await this.storage.upload(optimized, storageKey, optimizedMime);

      mimeType = optimizedMime;
      fileSize = optimized.length;

      // Thumbnail
      const { buffer: thumb, mimeType: thumbMime, extension: thumbExt } =
        await this.imageOptimizer.generateThumbnail(file.buffer);

      const thumbName = `${uuid}-thumb${thumbExt}`;
      thumbnailKey = this.storage.buildKey(entityType, entityId, thumbName);
      await this.storage.upload(thumb, thumbnailKey, thumbMime);
    } else {
      // PDF, DOCX vb. — direkt yükle
      const ext = path.extname(file.originalname) || '';
      const baseName = `${uuid}${ext}`;
      storageKey = this.storage.buildKey(entityType, entityId, baseName);
      await this.storage.upload(file.buffer, storageKey, file.mimetype);
    }

    const ext = path.extname(file.originalname);
    const data = await this.prisma.entityDocument.create({
      data: {
        entityType,
        entityId,
        documentTypeId: documentTypeId ?? null,
        fileName: file.originalname,
        fileExtension: ext,
        mimeType,
        fileSize,
        storageKey,
        thumbnailKey,
        notes: notes ?? null,
        uploadedByUserId,
      },
      include: {
        documentType: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return { data };
  }

  async getSignedUrl(
    id: string,
    expiresIn = 900,
    user?: any,
    insuranceCompanyIds?: string[],
  ): Promise<{ url: string; fileName: string; mimeType: string }> {
    const doc = await this.prisma.entityDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');
    await this.assertEntityAccess(doc.entityType, doc.entityId, user, insuranceCompanyIds);

    const url = await this.storage.getSignedUrl(doc.storageKey, expiresIn);
    return { url, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  async getThumbnailSignedUrl(
    id: string,
    expiresIn = 900,
    user?: any,
    insuranceCompanyIds?: string[],
  ): Promise<{ url: string }> {
    const doc = await this.prisma.entityDocument.findUnique({ where: { id } });
    if (!doc || !doc.thumbnailKey) throw new NotFoundException('Thumbnail bulunamadı');
    await this.assertEntityAccess(doc.entityType, doc.entityId, user, insuranceCompanyIds);

    const url = await this.storage.getSignedUrl(doc.thumbnailKey, expiresIn);
    return { url };
  }

  async remove(id: string, user?: any, insuranceCompanyIds?: string[]) {
    const doc = await this.prisma.entityDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');
    await this.assertEntityAccess(doc.entityType, doc.entityId, user, insuranceCompanyIds);

    await this.storage.delete(doc.storageKey);
    if (doc.thumbnailKey) {
      await this.storage.delete(doc.thumbnailKey);
    }

    await this.prisma.entityDocument.delete({ where: { id } });
    return { message: 'Evrak silindi' };
  }
}
