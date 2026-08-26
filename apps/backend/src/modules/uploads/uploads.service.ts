import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { randomUUID } from 'crypto';

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
  async getSignedUrl(storageKey: string, expiresIn = 900): Promise<string> {
    return this.storage.getSignedUrl(storageKey, expiresIn);
  }

  async getFileBuffer(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (!storageKey?.trim()) {
      throw new BadRequestException('storageKey zorunlu');
    }
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
}
