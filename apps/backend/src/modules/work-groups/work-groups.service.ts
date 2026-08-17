import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateWorkGroupDto } from './dto/create-work-group.dto';
import { UpdateWorkGroupDto } from './dto/update-work-group.dto';
import { CreateWorkSubGroupDto } from '../work-sub-groups/dto/create-work-sub-group.dto';
import { UpdateWorkSubGroupDto } from '../work-sub-groups/dto/update-work-sub-group.dto';
import { CreatePriceListVersionDto } from './dto/create-price-list-version.dto';
import * as XLSX from 'xlsx';

@Injectable()
export class WorkGroupsService {
  constructor(private prisma: PrismaService) {}

  async findAll(status?: string) {
    return this.prisma.workGroup.findMany({
      where: status ? { status } : undefined,
      include: {
        targetMargin: true,
        workSubGroups: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        _count: { select: { workSubGroups: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateWorkGroupDto) {
    const code = dto.code.toUpperCase().replace(/\s+/g, '_');
    const existing = await this.prisma.workGroup.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`"${code}" kodu zaten kullanımda`);
    const nameConflict = await this.prisma.workGroup.findFirst({ where: { name: dto.name } });
    if (nameConflict) throw new ConflictException('Bu isimde bir iş grubu zaten mevcut');
    return this.prisma.workGroup.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        unit: dto.unit,
        sortOrder: dto.sortOrder ?? 99,
        isSystem: false,
      },
    });
  }

  async update(id: string, dto: UpdateWorkGroupDto) {
    const wg = await this.prisma.workGroup.findUnique({ where: { id } });
    if (!wg) throw new NotFoundException('İş grubu bulunamadı');
    if (wg.isSystem && dto.status === 'inactive') {
      throw new BadRequestException('Sistem iş grupları pasif yapılamaz');
    }
    if (dto.name && dto.name !== wg.name) {
      const nameConflict = await this.prisma.workGroup.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (nameConflict) throw new ConflictException('Bu isimde bir iş grubu zaten mevcut');
    }
    return this.prisma.workGroup.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const wg = await this.prisma.workGroup.findUnique({ where: { id } });
    if (!wg) throw new NotFoundException('İş grubu bulunamadı');

    const [reportItemCount, statementItemCount, templateItemCount] = await Promise.all([
      this.prisma.repairReportItem.count({ where: { workGroupId: id } }),
      this.prisma.vendorStatementItem.count({ where: { workGroupId: id } }),
      this.prisma.reportTemplateItem.count({ where: { workGroupId: id } }),
    ]);

    if (reportItemCount > 0) {
      throw new BadRequestException(
        'Bu hizmet kolu onarım raporlarında kullanılıyor; silinemez. Pasif yapmayı deneyin.',
      );
    }
    if (statementItemCount > 0) {
      throw new BadRequestException('Bu hizmet kolu tedarikçi ekstrelerinde kullanılıyor; silinemez.');
    }
    if (templateItemCount > 0) {
      throw new BadRequestException('Bu hizmet kolu rapor şablonlarında kullanılıyor; silinemez.');
    }

    await this.prisma.workGroup.delete({ where: { id } });
    return { message: 'İş grubu silindi' };
  }

  async getSubGroups(workGroupId: string) {
    const wg = await this.prisma.workGroup.findUnique({ where: { id: workGroupId } });
    if (!wg) throw new NotFoundException('İş grubu bulunamadı');
    return this.prisma.workSubGroup.findMany({
      where: { workGroupId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createSubGroup(workGroupId: string, dto: CreateWorkSubGroupDto) {
    const wg = await this.prisma.workGroup.findUnique({ where: { id: workGroupId } });
    if (!wg) throw new NotFoundException('İş grubu bulunamadı');

    const code = dto.code.toUpperCase().replace(/\s+/g, '_');
    const existing = await this.prisma.workSubGroup.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`"${code}" kodu zaten kullanımda`);

    const nameConflict = await this.prisma.workSubGroup.findFirst({
      where: { name: dto.name, workGroupId },
    });
    if (nameConflict) throw new ConflictException('Bu isimde bir alt grup zaten mevcut');

    return this.prisma.workSubGroup.create({
      data: {
        workGroupId,
        code,
        name: dto.name,
        description: dto.description,
        unitType: dto.unitType,
        unitPrice: dto.unitPrice !== undefined ? dto.unitPrice : undefined,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSubGroup(id: string, dto: UpdateWorkSubGroupDto) {
    const sub = await this.prisma.workSubGroup.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Alt grup bulunamadı');

    const nextWorkGroupId = dto.workGroupId ?? sub.workGroupId;
    if (dto.workGroupId && dto.workGroupId !== sub.workGroupId) {
      const wg = await this.prisma.workGroup.findUnique({ where: { id: dto.workGroupId } });
      if (!wg) throw new NotFoundException('İş grubu bulunamadı');
    }

    if (dto.name && dto.name !== sub.name) {
      const nameConflict = await this.prisma.workSubGroup.findFirst({
        where: { name: dto.name, workGroupId: nextWorkGroupId, NOT: { id } },
      });
      if (nameConflict) throw new ConflictException('Bu isimde bir alt grup zaten mevcut');
    }
    return this.prisma.workSubGroup.update({
      where: { id },
      data: {
        workGroupId: dto.workGroupId,
        name: dto.name,
        description: dto.description,
        unitType: dto.unitType,
        unitPrice: dto.unitPrice !== undefined ? dto.unitPrice : undefined,
        sortOrder: dto.sortOrder,
        status: dto.status,
      },
    });
  }

  async removeSubGroup(id: string) {
    const sub = await this.prisma.workSubGroup.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Alt grup bulunamadı');
    await this.prisma.workSubGroup.delete({ where: { id } });
    return { message: 'Alt grup silindi' };
  }

  async getTargetMargin(workGroupId: string) {
    const wg = await this.prisma.workGroup.findUnique({ where: { id: workGroupId } });
    if (!wg) throw new NotFoundException('İş grubu bulunamadı');
    const tm = await this.prisma.targetMargin.findUnique({ where: { workGroupId } });
    return tm ?? { workGroupId, minMarginPct: 0, warnBelowPct: null };
  }

  async upsertTargetMargin(workGroupId: string, dto: { minMarginPct: number; warnBelowPct?: number }) {
    const wg = await this.prisma.workGroup.findUnique({ where: { id: workGroupId } });
    if (!wg) throw new NotFoundException('İş grubu bulunamadı');
    return this.prisma.targetMargin.upsert({
      where: { workGroupId },
      update: { minMarginPct: dto.minMarginPct, warnBelowPct: dto.warnBelowPct },
      create: { workGroupId, minMarginPct: dto.minMarginPct, warnBelowPct: dto.warnBelowPct },
    });
  }

  async getPriceSuggestions(workGroupId: string, q: string) {
    const history = await this.prisma.supplierPriceHistory.findMany({
      where: {
        workGroupId,
        jobDescription: { contains: q, mode: 'insensitive' },
      },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    });
    const seen = new Map<string, (typeof history)[0]>();
    for (const h of history) {
      const key = `${h.jobDescription}__${h.unit ?? ''}`;
      if (!seen.has(key)) seen.set(key, h);
    }
    return Array.from(seen.values()).slice(0, 10);
  }

  async calculatePrice(subGroupId: string, regionId?: string) {
    const sub = await this.prisma.workSubGroup.findUnique({ where: { id: subGroupId } });
    if (!sub) throw new NotFoundException('Alt grup bulunamadı');

    const basePrice = sub.unitPrice ? Number(sub.unitPrice) : 0;
    if (!regionId) {
      return { subGroupId, basePrice, adjustmentPercent: 0, finalPrice: basePrice };
    }

    const region = await this.prisma.region.findUnique({ where: { id: regionId } });
    if (!region) throw new NotFoundException('Bölge bulunamadı');

    const latestAdj = await this.prisma.regionalPriceAdjustment.findFirst({
      where: { regionId, effectiveDate: { lte: new Date() } },
      orderBy: { effectiveDate: 'desc' },
    });

    const adjustmentPercent = latestAdj ? Number(latestAdj.adjustmentPercent) : 0;
    const finalPrice = basePrice * (1 + adjustmentPercent / 100);

    return {
      subGroupId,
      subGroupName: sub.name,
      unitType: sub.unitType,
      basePrice,
      regionId,
      regionName: region.name,
      adjustmentPercent,
      finalPrice: Math.round(finalPrice * 100) / 100,
    };
  }

  async importFromExcel(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const errors: Array<{ row: number; message: string }> = [];
    let created = 0;
    let updated = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      const groupName = String(row[0] ?? '').trim();
      const subGroupName = String(row[1] ?? '').trim();
      const unitType = String(row[2] ?? 'adet').trim().toLowerCase();
      const unitPriceRaw = row[3];

      if (!groupName && !subGroupName) continue;

      if (!groupName) {
        errors.push({ row: rowNum, message: 'İş grubu adı boş olamaz' });
        continue;
      }
      if (!subGroupName) {
        errors.push({ row: rowNum, message: 'Alt grup adı boş olamaz' });
        continue;
      }

      const unitPrice =
        unitPriceRaw !== '' && unitPriceRaw !== undefined ? Number(unitPriceRaw) : undefined;
      if (unitPrice !== undefined && isNaN(unitPrice)) {
        errors.push({ row: rowNum, message: 'Geçersiz birim fiyat değeri' });
        continue;
      }

      const validUnits = ['m²', 'adet', 'metre', 'saat', 'kg', 'ton'];
      const normalizedUnit = validUnits.find((u) => u === unitType) ?? 'adet';

      try {
        let workGroup = await this.prisma.workGroup.findFirst({
          where: { name: { equals: groupName, mode: 'insensitive' } },
        });

        if (!workGroup) {
          const code = groupName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
          let finalCode = code;
          let suffix = 1;
          while (await this.prisma.workGroup.findUnique({ where: { code: finalCode } })) {
            finalCode = `${code}_${suffix++}`;
          }
          workGroup = await this.prisma.workGroup.create({
            data: { code: finalCode, name: groupName, isSystem: false, sortOrder: 99 },
          });
        }

        const existingSub = await this.prisma.workSubGroup.findFirst({
          where: {
            name: { equals: subGroupName, mode: 'insensitive' },
            workGroupId: workGroup.id,
          },
        });

        if (existingSub) {
          await this.prisma.workSubGroup.update({
            where: { id: existingSub.id },
            data: {
              unitType: normalizedUnit,
              unitPrice: unitPrice ?? existingSub.unitPrice,
            },
          });
          updated++;
        } else {
          const code = subGroupName
            .toUpperCase()
            .replace(/\s+/g, '_')
            .replace(/[^A-Z0-9_]/g, '');
          let finalCode = code;
          let suffix = 1;
          while (await this.prisma.workSubGroup.findUnique({ where: { code: finalCode } })) {
            finalCode = `${code}_${suffix++}`;
          }
          await this.prisma.workSubGroup.create({
            data: {
              workGroupId: workGroup.id,
              code: finalCode,
              name: subGroupName,
              unitType: normalizedUnit,
              unitPrice: unitPrice,
              sortOrder: 0,
            },
          });
          created++;
        }
      } catch (err: any) {
        errors.push({ row: rowNum, message: err.message ?? 'Beklenmeyen hata' });
      }
    }

    return { created, updated, errors, total: rows.length - 1 };
  }

  async listPriceListVersions() {
    return this.prisma.priceListVersion.findMany({
      orderBy: { effectiveDate: 'desc' },
    });
  }

  async createPriceListVersion(dto: CreatePriceListVersionDto) {
    return this.prisma.priceListVersion.create({
      data: {
        versionName: dto.versionName,
        effectiveDate: new Date(dto.effectiveDate),
        notes: dto.notes,
        isActive: false,
      },
    });
  }

  async activatePriceListVersion(id: string) {
    const version = await this.prisma.priceListVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException('Versiyon bulunamadı');
    await this.prisma.priceListVersion.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    return this.prisma.priceListVersion.update({ where: { id }, data: { isActive: true } });
  }

  async seedData() {
    const groups = [
      {
        name: 'Tesisat',
        code: 'TESISAT',
        subs: [
          { name: 'Musluk Değişimi', unit: 'adet', price: 350 },
          { name: 'Boru Tamiri', unit: 'metre', price: 120 },
          { name: 'Su Tesisatı Döşeme', unit: 'metre', price: 180 },
        ],
      },
      {
        name: 'Elektrik',
        code: 'ELEKTRIK',
        subs: [
          { name: 'Sigorta Kutusu Değişimi', unit: 'adet', price: 450 },
          { name: 'Kablo Çekimi', unit: 'metre', price: 85 },
          { name: 'Aydınlatma Armatürü', unit: 'adet', price: 250 },
        ],
      },
      {
        name: 'Boya',
        code: 'BOYA',
        subs: [
          { name: 'İç Duvar Boyası', unit: 'm²', price: 75 },
          { name: 'Dış Cephe Boyası', unit: 'm²', price: 110 },
          { name: 'Ahşap Yüzey Boyası', unit: 'm²', price: 90 },
        ],
      },
      {
        name: 'İnşaat',
        code: 'INSAAT',
        subs: [
          { name: 'Sıva', unit: 'm²', price: 65 },
          { name: 'Alçıpan Kaplama', unit: 'm²', price: 95 },
          { name: 'Seramik / Fayans', unit: 'm²', price: 150 },
        ],
      },
      {
        name: 'Mobilya',
        code: 'MOBILYA',
        subs: [
          { name: 'Dolap Montajı', unit: 'adet', price: 300 },
          { name: 'Kapı Değişimi', unit: 'adet', price: 850 },
        ],
      },
      {
        name: 'Cam',
        code: 'CAM',
        subs: [
          { name: 'Cam Değişimi', unit: 'm²', price: 180 },
          { name: 'PVC Pencere', unit: 'adet', price: 1200 },
        ],
      },
    ];

    const result = { created: 0, skipped: 0, subGroupsCreated: 0 };
    for (const g of groups) {
      let wg = await this.prisma.workGroup.findFirst({ where: { name: g.name } });
      if (!wg) {
        let finalCode = g.code;
        let suffix = 1;
        while (await this.prisma.workGroup.findUnique({ where: { code: finalCode } })) {
          finalCode = `${g.code}_${suffix++}`;
        }
        wg = await this.prisma.workGroup.create({
          data: { code: finalCode, name: g.name, isSystem: false, sortOrder: 99 },
        });
        result.created++;
      } else {
        result.skipped++;
      }

      for (const sub of g.subs) {
        const existing = await this.prisma.workSubGroup.findFirst({
          where: { name: sub.name, workGroupId: wg.id },
        });
        if (!existing) {
          const code = sub.name
            .toUpperCase()
            .replace(/\s+/g, '_')
            .replace(/[^A-Z0-9_]/g, '');
          let finalCode = code;
          let suffix = 1;
          while (await this.prisma.workSubGroup.findUnique({ where: { code: finalCode } })) {
            finalCode = `${code}_${suffix++}`;
          }
          await this.prisma.workSubGroup.create({
            data: {
              workGroupId: wg.id,
              code: finalCode,
              name: sub.name,
              unitType: sub.unit,
              unitPrice: sub.price,
              sortOrder: 0,
            },
          });
          result.subGroupsCreated++;
        }
      }
    }
    return result;
  }
}
