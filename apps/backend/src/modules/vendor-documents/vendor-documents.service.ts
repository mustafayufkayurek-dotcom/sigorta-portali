import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { ImageOptimizerService } from '@/modules/storage/image-optimizer.service';
import { randomUUID } from 'crypto';
import * as path from 'path';

@Injectable()
export class VendorDocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private imageOptimizer: ImageOptimizerService,
  ) {}

  async findByVendor(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Tedarikçi bulunamadı');

    const data = await this.prisma.vendorDocument.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: {
        documentType: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return { data };
  }

  async create(
    vendorId: string,
    file: Express.Multer.File,
    documentTypeId: string,
    uploadedByUserId: string,
  ) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Tedarikçi bulunamadı');

    const docType = await this.prisma.documentType.findUnique({
      where: { id: documentTypeId },
    });
    if (!docType) throw new NotFoundException('Evrak türü bulunamadı');

    const isImage = this.imageOptimizer.isImage(file.mimetype);
    const uuid = randomUUID();

    let storageKey: string;
    let thumbnailKey: string | null = null;
    let mimeType = file.mimetype;
    let fileSize = file.size;

    if (isImage) {
      const { buffer: optimized, mimeType: optimizedMime, extension } =
        await this.imageOptimizer.optimizeImage(file.buffer);

      const baseName = `${uuid}-optimized${extension}`;
      storageKey = this.storage.buildKey('vendors', vendorId, baseName);
      await this.storage.upload(optimized, storageKey, optimizedMime);

      mimeType = optimizedMime;
      fileSize = optimized.length;

      const { buffer: thumb, mimeType: thumbMime, extension: thumbExt } =
        await this.imageOptimizer.generateThumbnail(file.buffer);

      const thumbName = `${uuid}-thumb${thumbExt}`;
      thumbnailKey = this.storage.buildKey('vendors', vendorId, thumbName);
      await this.storage.upload(thumb, thumbnailKey, thumbMime);
    } else {
      const ext = path.extname(file.originalname) || '';
      const baseName = `${uuid}${ext}`;
      storageKey = this.storage.buildKey('vendors', vendorId, baseName);
      await this.storage.upload(file.buffer, storageKey, file.mimetype);
    }

    const ext = path.extname(file.originalname);
    const data = await this.prisma.vendorDocument.create({
      data: {
        vendorId,
        documentTypeId,
        fileName: file.originalname,
        fileExtension: ext,
        mimeType,
        fileSize,
        storageKey,
        thumbnailKey,
        uploadedByUserId,
      },
      include: {
        documentType: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return { data };
  }

  async getSignedUrl(id: string, expiresIn = 900): Promise<{ url: string; fileName: string; mimeType: string }> {
    const doc = await this.prisma.vendorDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');

    const url = await this.storage.getSignedUrl(doc.storageKey, expiresIn);
    return { url, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  async getThumbnailSignedUrl(id: string, expiresIn = 900): Promise<{ url: string }> {
    const doc = await this.prisma.vendorDocument.findUnique({ where: { id } });
    if (!doc || !doc.thumbnailKey) throw new NotFoundException('Thumbnail bulunamadı');

    const url = await this.storage.getSignedUrl(doc.thumbnailKey, expiresIn);
    return { url };
  }

  async remove(id: string) {
    const doc = await this.prisma.vendorDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Evrak bulunamadı');

    await this.storage.delete(doc.storageKey);
    if (doc.thumbnailKey) {
      await this.storage.delete(doc.thumbnailKey);
    }

    await this.prisma.vendorDocument.delete({ where: { id } });
    return { message: 'Evrak silindi' };
  }
}
