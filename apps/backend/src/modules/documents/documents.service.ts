import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: {
    page?: number;
    limit?: number;
    claimFileId?: string;
    documentType?: string;
  }) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { isLatest: true };
    if (params?.claimFileId) where.claimFileId = params.claimFileId;
    if (params?.documentType) where.documentType = params.documentType;

    const [data, total] = await Promise.all([
      this.prisma.claimDocument.findMany({
        where,
        skip,
        take: limit,
        include: { fileAsset: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.claimDocument.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const doc = await this.prisma.claimDocument.findUnique({
      where: { id },
      include: {
        fileAsset: true,
        claimFile: { select: { id: true, fileNo: true } },
      },
    });
    if (!doc) {
      throw new NotFoundException('Belge bulunamadı');
    }
    return doc;
  }

  async create(data: any, userId: string) {
    // Create the file asset first then link as claim document
    const { claimFileId, documentType, fileName, fileExtension, mimeType, fileSize, storageKey, category } = data;

    const fileAsset = await this.prisma.fileAsset.create({
      data: {
        ownerType: 'claim_file',
        ownerId: claimFileId,
        fileName,
        fileExtension,
        mimeType,
        fileSize,
        storageKey,
        category,
        uploadedByUserId: userId,
      },
    });

    return this.prisma.claimDocument.create({
      data: {
        claimFileId,
        fileAssetId: fileAsset.id,
        documentType,
      },
      include: { fileAsset: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.claimDocument.delete({ where: { id } });
    return { message: 'Belge silindi' };
  }
}
