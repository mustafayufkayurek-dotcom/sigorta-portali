import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { ImageOptimizerService } from '@/modules/storage/image-optimizer.service';
import { orientPhotoBuffer } from '@/modules/storage/orient-photo';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { normalizeRequestUser } from '@/common/helpers/claim-file-scope.helper';
import {
  assertScopedFileEntityAccess,
  rethrowDownloadAccess,
} from '@/common/helpers/document-download-access';

@Injectable()
export class EntityDocumentsService {
  private readonly logger = new Logger(EntityDocumentsService.name);

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

    await assertScopedFileEntityAccess(this.prisma, entityType, entityId, {
      ...requestingUser,
      insuranceCompanyScopes: insuranceCompanyIds ?? user?.insuranceCompanyScopes,
      assistantCustomerScopes: user?.assistantCustomerScopes,
    });

    if (entityType === 'hr_leave_request') {
      const leaveRequest = await this.prisma.hrLeaveRequest.findUnique({
        where: { id: entityId },
        select: { employeeProfile: { select: { userId: true } } },
      });
      if (!leaveRequest) throw new NotFoundException('İzin talebi bulunamadı');
      const isOwner = leaveRequest.employeeProfile.userId === requestingUser.id;
      const canApproveLeave =
        requestingUser.roleCode?.toUpperCase() === 'ADMIN'
        || (requestingUser.permissions ?? []).includes('hr.leave.approve');
      if (!isOwner && !canApproveLeave) {
        throw new ForbiddenException('Bu izin talebine erişim izniniz bulunmamaktadır');
      }
      return;
    }

    if (entityType === 'hr_employee_profile') {
      const profile = await this.prisma.hrEmployeeProfile.findUnique({
        where: { id: entityId },
        select: { userId: true },
      });
      if (!profile) throw new NotFoundException('Personel profili bulunamadı');
      const isOwner = profile.userId === requestingUser.id;
      const role = requestingUser.roleCode?.toUpperCase() ?? '';
      const perms = requestingUser.permissions ?? [];
      const canViewHr =
        role === 'ADMIN'
        || role === 'FINANCE'
        || role === 'FINANS'
        || role === 'ACCOUNTANT'
        || perms.includes('hr.supervise')
        || perms.includes('hr.attendance.manage')
        || perms.includes('hr.leave.approve')
        || perms.includes('hr.documents.manage');
      if (!isOwner && !canViewHr) {
        throw new ForbiddenException('Bu özlük dosyasına erişim izniniz bulunmamaktadır');
      }
    }
  }

  /** Özlük evrak yükleme: Finans + yetkili; Admin yüklemez, personel kendi yüklemez. */
  private assertPersonnelDocumentWrite(user?: any): void {
    const requestingUser = normalizeRequestUser(user);
    if (!requestingUser) {
      throw new ForbiddenException('Kullanıcı bilgisi bulunamadı');
    }
    const role = requestingUser.roleCode?.toUpperCase() ?? '';
    if (role === 'ADMIN') {
      throw new ForbiddenException(
        'Özlük evrak yükleme Finans veya yetkili personel tarafından yapılır. Admin yalnızca denetler.',
      );
    }
    if (role === 'FINANCE' || role === 'FINANS' || role === 'ACCOUNTANT') return;
    if ((requestingUser.permissions ?? []).includes('hr.documents.manage')) return;
    throw new ForbiddenException(
      'Özlük evrak yükleme yetkiniz yok. Bu işlem Finans veya yetkili personel tarafından yapılır.',
    );
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
    if (entityType === 'hr_employee_profile') {
      this.assertPersonnelDocumentWrite(requestingUser);
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Yüklenen dosya boş veya okunamadı');
    }

    const uploaderId = uploadedByUserId || requestingUser?.id || requestingUser?.userId;
    if (!uploaderId) {
      throw new ForbiddenException('Kullanıcı bilgisi bulunamadı');
    }

    try {
      const isImage = this.imageOptimizer.isImage(file.mimetype, file.originalname);
      const uuid = randomUUID();

      let storageKey: string;
      let thumbnailKey: string | null = null;
      let mimeType = file.mimetype;
      let fileSize = file.size;

      if (isImage) {
        try {
          const { buffer: optimized, mimeType: optimizedMime, extension } =
            await this.imageOptimizer.optimizeImage(file.buffer);

          const baseName = `${uuid}-optimized${extension}`;
          storageKey = this.storage.buildKey(entityType, entityId, baseName);
          await this.storage.upload(optimized, storageKey, optimizedMime);

          mimeType = optimizedMime;
          fileSize = optimized.length;

          try {
            const { buffer: thumb, mimeType: thumbMime, extension: thumbExt } =
              await this.imageOptimizer.generateThumbnail(file.buffer);
            const thumbName = `${uuid}-thumb${thumbExt}`;
            thumbnailKey = this.storage.buildKey(entityType, entityId, thumbName);
            await this.storage.upload(thumb, thumbnailKey, thumbMime);
          } catch (thumbErr) {
            this.logger.warn(
              `entity-documents thumb skipped (${entityType}/${entityId}): ${
                thumbErr instanceof Error ? thumbErr.message : String(thumbErr)
              }`,
            );
            thumbnailKey = null;
          }
        } catch (procErr) {
          this.logger.warn(
            `entity-documents image process fallback (${entityType}/${entityId}): ${
              procErr instanceof Error ? procErr.message : String(procErr)
            }`,
          );
          const ext = path.extname(file.originalname) || '';
          const baseName = `${uuid}${ext}`;
          storageKey = this.storage.buildKey(entityType, entityId, baseName);
          await this.storage.upload(file.buffer, storageKey, file.mimetype);
          mimeType = file.mimetype;
          fileSize = file.size;
          thumbnailKey = null;
        }
      } else {
        // PDF, DOCX, HEIC vb. — direkt yükle
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
          uploadedByUserId: uploaderId,
        },
        include: {
          documentType: { select: { id: true, code: true, name: true } },
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return { data };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `entity-documents upload failed (${entityType}/${entityId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // sharp / beklenmeyen işleme hataları → anlamlı 400; storage zaten 503 map eder
      if (/sharp|unsupported image|Input buffer/i.test(String((error as Error)?.message ?? error))) {
        throw new BadRequestException(
          'Resim işlenemedi. JPG veya PNG deneyin; HEIC desteklenmeyebilir.',
        );
      }
      throw new ServiceUnavailableException(
        'Dosya yüklenemedi. Lütfen kısa süre sonra tekrar deneyin.',
      );
    }
  }

  async getSignedUrl(
    id: string,
    expiresIn = 900,
    user?: any,
    insuranceCompanyIds?: string[],
  ): Promise<{ url: string; fileName: string; mimeType: string }> {
    const doc = await this.prisma.entityDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');
    try {
      await this.assertEntityAccess(doc.entityType, doc.entityId, user, insuranceCompanyIds);
    } catch (error) {
      rethrowDownloadAccess(error);
    }

    const url = await this.storage.getSignedUrl(doc.storageKey, expiresIn);
    return { url, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  /** Tarayıcıya bayt akıt — 302 imzalı URL yok (MinIO + Authorization kırılması). */
  async getFileBuffer(
    id: string,
    user?: any,
    insuranceCompanyIds?: string[],
    preferThumb = false,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const doc = await this.prisma.entityDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');
    try {
      await this.assertEntityAccess(doc.entityType, doc.entityId, user, insuranceCompanyIds);
    } catch (error) {
      rethrowDownloadAccess(error);
    }

    const key = doc.storageKey;
    const downloaded = await this.storage.download(key);
    if (!this.imageOptimizer.isImage(doc.mimeType, doc.fileName)) {
      return { buffer: downloaded, fileName: doc.fileName, mimeType: doc.mimeType || 'application/octet-stream' };
    }
    if (preferThumb && doc.thumbnailKey) {
      try {
        const storedThumb = await this.storage.download(doc.thumbnailKey);
        return { buffer: storedThumb, fileName: doc.fileName, mimeType: 'image/webp' };
      } catch {
        /* üretilmiş kare yoksa aşağıda çevir */
      }
    }
    try {
      const oriented = await orientPhotoBuffer(downloaded);
      if (preferThumb) {
        const thumb = await sharp(oriented.buffer)
          .resize(360, 360, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 78 })
          .toBuffer();
        return { buffer: thumb, fileName: doc.fileName, mimeType: 'image/jpeg' };
      }
      const full = await sharp(oriented.buffer).jpeg({ quality: 84 }).toBuffer();
      return { buffer: full, fileName: doc.fileName, mimeType: 'image/jpeg' };
    } catch {
      return {
        buffer: downloaded,
        fileName: doc.fileName,
        mimeType: doc.mimeType || 'image/jpeg',
      };
    }
  }

  async getThumbnailSignedUrl(
    id: string,
    expiresIn = 900,
    user?: any,
    insuranceCompanyIds?: string[],
  ): Promise<{ url: string }> {
    const doc = await this.prisma.entityDocument.findUnique({ where: { id } });
    if (!doc || !doc.thumbnailKey) throw new NotFoundException('Thumbnail bulunamadı');
    try {
      await this.assertEntityAccess(doc.entityType, doc.entityId, user, insuranceCompanyIds);
    } catch (error) {
      rethrowDownloadAccess(error);
    }

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
