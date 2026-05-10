import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: {
    page?: number;
    limit?: number;
    claimFileId?: string;
    noteType?: string;
  }) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.claimFileId) where.claimFileId = params.claimFileId;
    if (params?.noteType) where.noteType = params.noteType;

    const [data, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.note.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        claimFile: { select: { id: true, fileNo: true } },
      },
    });
    if (!note) {
      throw new NotFoundException('Not bulunamadı');
    }
    return note;
  }

  async create(data: any, userId: string) {
    return this.prisma.note.create({
      data: { ...data, authorUserId: userId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, data: any, userId: string) {
    const note = await this.findOne(id);
    if (note.authorUserId !== userId) {
      throw new ForbiddenException('Bu notu düzenleme yetkiniz yok');
    }
    return this.prisma.note.update({
      where: { id },
      data: { content: data.content, noteType: data.noteType, isPrivate: data.isPrivate },
    });
  }

  async remove(id: string, userId: string) {
    const note = await this.findOne(id);
    if (note.authorUserId !== userId) {
      throw new ForbiddenException('Bu notu silme yetkiniz yok');
    }
    await this.prisma.note.delete({ where: { id } });
    return { message: 'Not silindi' };
  }
}
