import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateTemplateItemDto } from './dto/create-template-item.dto';
import { UpdateTemplateItemDto } from './dto/update-template-item.dto';

const ITEM_INCLUDE = {
  workGroup: { select: { id: true, code: true, name: true, unit: true } },
};

const TEMPLATE_INCLUDE = {
  items: {
    include: ITEM_INCLUDE,
    orderBy: { sortOrder: 'asc' as const },
  },
};

@Injectable()
export class ReportTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const templates = await this.prisma.reportTemplate.findMany({
      include: TEMPLATE_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return templates;
  }

  async findOne(id: string) {
    const template = await this.prisma.reportTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) throw new NotFoundException('Şablon bulunamadı');
    return template;
  }

  async create(dto: CreateTemplateDto) {
    const conflict = await this.prisma.reportTemplate.findFirst({
      where: { name: dto.name, serviceType: dto.serviceType },
    });
    if (conflict) throw new ConflictException('Bu isim ve hizmet türünde bir şablon zaten mevcut');
    return this.prisma.reportTemplate.create({
      data: {
        name: dto.name,
        serviceType: dto.serviceType,
        description: dto.description,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: TEMPLATE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const template = await this.findOne(id);
    if (dto.name || dto.serviceType) {
      const conflict = await this.prisma.reportTemplate.findFirst({
        where: {
          name: dto.name ?? template.name,
          serviceType: dto.serviceType ?? template.serviceType,
          NOT: { id },
        },
      });
      if (conflict) throw new ConflictException('Bu isim ve hizmet türünde bir şablon zaten mevcut');
    }
    return this.prisma.reportTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.serviceType !== undefined && { serviceType: dto.serviceType }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: TEMPLATE_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.reportTemplate.delete({ where: { id } });
    return { message: 'Şablon silindi' };
  }

  async addItem(templateId: string, dto: CreateTemplateItemDto) {
    await this.findOne(templateId);
    return this.prisma.reportTemplateItem.create({
      data: {
        templateId,
        workGroupId: dto.workGroupId,
        damageCategory: dto.damageCategory ?? 'bina',
        location: dto.location,
        jobDescription: dto.jobDescription,
        description: dto.description,
        defaultQuantity: dto.defaultQuantity ?? 1,
        defaultUnit: dto.defaultUnit ?? 'adet',
        pricingType: dto.pricingType ?? 'unit',
        sortOrder: dto.sortOrder ?? 0,
      },
      include: ITEM_INCLUDE,
    });
  }

  async updateItem(itemId: string, dto: UpdateTemplateItemDto) {
    const item = await this.prisma.reportTemplateItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Kalem bulunamadı');
    return this.prisma.reportTemplateItem.update({
      where: { id: itemId },
      data: {
        ...(dto.workGroupId !== undefined && { workGroupId: dto.workGroupId }),
        ...(dto.damageCategory !== undefined && { damageCategory: dto.damageCategory }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.jobDescription !== undefined && { jobDescription: dto.jobDescription }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.defaultQuantity !== undefined && { defaultQuantity: dto.defaultQuantity }),
        ...(dto.defaultUnit !== undefined && { defaultUnit: dto.defaultUnit }),
        ...(dto.pricingType !== undefined && { pricingType: dto.pricingType }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: ITEM_INCLUDE,
    });
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.reportTemplateItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Kalem bulunamadı');
    await this.prisma.reportTemplateItem.delete({ where: { id: itemId } });
    return { message: 'Kalem silindi' };
  }

  async reorderItems(templateId: string, orderedIds: string[]) {
    await this.findOne(templateId);
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.reportTemplateItem.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.findOne(templateId);
  }

  async suggest(serviceType: string) {
    const templates = await this.prisma.reportTemplate.findMany({
      where: { serviceType, isActive: true },
      include: TEMPLATE_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return templates;
  }
}
