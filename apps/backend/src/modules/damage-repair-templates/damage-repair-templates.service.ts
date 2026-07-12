import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateDamageRepairTemplateDto, SuggestionsDto, UpdateDamageRepairTemplateDto } from './dto/damage-repair-templates.dto';

@Injectable()
export class DamageRepairTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { damageType?: string; fileId?: string }) {
    return this.prisma.damageTypeRepairTemplate.findMany({
      where: {
        damageType: query.damageType,
        ...(query.fileId ? { OR: [{ isGlobal: true }, { fileId: query.fileId }] } : {}),
      },
      include: { workSubGroup: true },
      orderBy: [{ usageCount: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateDamageRepairTemplateDto, userId?: string) {
    try {
      return await this.prisma.damageTypeRepairTemplate.create({
        data: { ...dto, createdBy: userId, isGlobal: true, fileId: null },
        include: { workSubGroup: true },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async createForFile(fileId: string, dto: CreateDamageRepairTemplateDto, userId?: string) {
    try {
      return await this.prisma.damageTypeRepairTemplate.create({
        data: { ...dto, fileId, isGlobal: false, createdBy: userId },
        include: { workSubGroup: true },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateDamageRepairTemplateDto) {
    await this.ensureExists(id);
    try {
      return await this.prisma.damageTypeRepairTemplate.update({
        where: { id },
        data: dto,
        include: { workSubGroup: true },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.damageTypeRepairTemplate.delete({ where: { id } });
    return { message: 'Şablon silindi' };
  }

  async getSuggestions(dto: SuggestionsDto) {
    if (!dto.damageTypes?.length) throw new BadRequestException('En az bir hasar türü seçilmelidir');
    const templates = await this.prisma.damageTypeRepairTemplate.findMany({
      where: {
        damageType: { in: dto.damageTypes },
        OR: [{ isGlobal: true }, ...(dto.fileId ? [{ fileId: dto.fileId, isGlobal: false }] : [])],
      },
      include: { workSubGroup: true },
      orderBy: [{ usageCount: 'desc' }, { sortOrder: 'asc' }],
    });

    const merged = new Map<string, any>();
    for (const template of templates) {
      const qty = this.getQuantityBySize(template, dto.damageSize);
      const existing = merged.get(template.workSubGroupId);
      if (!existing || qty > existing.suggestedQuantity || (qty === existing.suggestedQuantity && template.usageCount > existing.usageCount)) {
        merged.set(template.workSubGroupId, {
          templateId: template.id,
          workSubGroupId: template.workSubGroupId,
          code: template.workSubGroup.code,
          name: template.workSubGroup.name,
          unitType: template.workSubGroup.unitType,
          unitPrice: template.workSubGroup.unitPrice ? Number(template.workSubGroup.unitPrice) : 0,
          suggestedQuantity: qty,
          usageCount: template.usageCount,
          damageType: template.damageType,
        });
      }
    }
    let items = Array.from(merged.values()).sort((a, b) => b.usageCount - a.usageCount);
    if (items.length === 0) {
      items = await this.fallbackQuickRepairSuggestions(dto.damageTypes, dto.damageSize);
    }
    return { items };
  }

  /** Şablon kaydı yoksa hasar türüne göre hızlı onarım kalemlerinden öneri üretir. */
  private async fallbackQuickRepairSuggestions(damageTypes: string[], damageSize?: string) {
    const qtyForSize = (size?: string) => (size === 'SMALL' ? 1 : size === 'LARGE' ? 3 : 2);

    const templates = await this.prisma.damageTypeRepairTemplate.findMany({
      where: {
        damageType: { in: damageTypes },
        OR: [{ isGlobal: true }, { fileId: null }],
      },
      include: { workSubGroup: true },
      orderBy: [{ sortOrder: 'asc' }, { usageCount: 'desc' }],
      take: 40,
    });

    if (templates.length > 0) {
      return templates
        .filter((t) => t.workSubGroup?.status === 'active')
        .map((template) => ({
          templateId: template.id,
          workSubGroupId: template.workSubGroupId,
          code: template.workSubGroup.code,
          name: template.workSubGroup.name,
          unitType: template.workSubGroup.unitType,
          unitPrice: template.workSubGroup.unitPrice ? Number(template.workSubGroup.unitPrice) : 0,
          suggestedQuantity: this.getQuantityBySize(template, damageSize) || qtyForSize(damageSize),
          usageCount: template.usageCount,
          damageType: template.damageType,
        }));
    }

    // Ayarlar İş Grubu / İş Alt Grubu kataloğundan öner (eski hizli_onarim yok)
    let subGroups = await this.prisma.workSubGroup.findMany({
      where: {
        status: 'active',
        workGroup: { status: 'active', code: { not: 'hizli_onarim' } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: 40,
    });

    if (subGroups.length === 0) {
      subGroups = await this.prisma.workSubGroup.findMany({
        where: { status: 'active' },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: 40,
      });
    }

    return subGroups.map((sg) => ({
      templateId: `fallback-${sg.id}`,
      workSubGroupId: sg.id,
      code: sg.code,
      name: sg.name,
      unitType: sg.unitType,
      unitPrice: sg.unitPrice ? Number(sg.unitPrice) : 0,
      suggestedQuantity: qtyForSize(damageSize),
      usageCount: 0,
      damageType: damageTypes[0] ?? 'FIRE_HOME',
    }));
  }

  async incrementUsage(id: string) {
    await this.ensureExists(id);
    return this.prisma.damageTypeRepairTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
  }

  async incrementUsageForItems(workSubGroupIds: string[], damageTypes: string[] = [], fileId?: string) {
    if (!workSubGroupIds.length) return;
    await this.prisma.damageTypeRepairTemplate.updateMany({
      where: {
        workSubGroupId: { in: workSubGroupIds },
        ...(damageTypes.length ? { damageType: { in: damageTypes } } : {}),
        OR: [{ isGlobal: true }, ...(fileId ? [{ fileId }] : [])],
      },
      data: { usageCount: { increment: 1 } },
    });
  }

  private getQuantityBySize(template: any, size?: string): number {
    if (size === 'SMALL') return template.defaultQuantitySmall ?? 1;
    if (size === 'LARGE') return template.defaultQuantityLarge ?? 1;
    return template.defaultQuantityMedium ?? 1;
  }

  private async ensureExists(id: string) {
    const item = await this.prisma.damageTypeRepairTemplate.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Şablon bulunamadı');
    return item;
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Bu hasar türü ve iş kalemi için şablon zaten mevcut');
    }
    throw error;
  }
}