import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { WhatsappParserService } from './whatsapp-parser.service';

@Injectable()
export class ChatArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: WhatsappParserService,
  ) {}

  async upload(dto: {
    claimFileId: string;
    label: string;
    rawContent: string;
    uploadedById: string;
  }) {
    const parsedMessages = this.parser.parse(dto.rawContent);

    return this.prisma.chatArchive.create({
      data: {
        claimFileId: dto.claimFileId,
        label: dto.label,
        rawContent: dto.rawContent,
        parsedMessages: parsedMessages as any,
        uploadedById: dto.uploadedById,
      },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async findByClaimFile(claimFileId: string) {
    const archives = await this.prisma.chatArchive.findMany({
      where: { claimFileId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return archives.map((a) => ({
      ...a,
      messageCount: Array.isArray(a.parsedMessages)
        ? (a.parsedMessages as any[]).length
        : 0,
      parsedMessages: undefined,
      rawContent: undefined,
    }));
  }

  async findOne(id: string) {
    const archive = await this.prisma.chatArchive.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!archive) {
      throw new NotFoundException('Chat archive not found');
    }

    return {
      ...archive,
      messageCount: Array.isArray(archive.parsedMessages)
        ? (archive.parsedMessages as any[]).length
        : 0,
    };
  }

  async remove(id: string) {
    const archive = await this.prisma.chatArchive.findUnique({ where: { id } });
    if (!archive) {
      throw new NotFoundException('Chat archive not found');
    }
    await this.prisma.chatArchive.delete({ where: { id } });
    return { id };
  }
}
