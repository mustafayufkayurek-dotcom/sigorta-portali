import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  MERIDYEN_SCOPE,
  VENDOR_SCOPE,
  meridyenScopeFilter,
  normalizeServiceBranchScope,
  resolveCreateScope,
} from './service-branch-scope';

/** Meridyen operasyon branşları — dosya / müşteri / sigorta / saha operasyonu */
const MERIDYEN_HASAR_BRANCHES = [
  'Dahili Su',
  'Yangın',
  'Hırsızlık',
  'Doğal Afet',
  'Fırtına',
  'Dolu',
  'Deprem',
  'Cam Kırılması',
  'Sel/Su Baskını',
  'Terör',
  'Elektronik Cihaz',
  'Makine Kırılması',
];

const MERIDYEN_ACIL_BRANCHES = [
  'Su Baskını',
  'Çatı Hasarı',
  'Cam Kırığı',
  'Kapı/Kilit Arızası',
  'Elektrik Arızası',
  'Doğalgaz Arızası',
  'Yangın Hasarı',
  'Hırsızlık/Güvenlik',
  'Boru Patlaması',
  'Asansör Arızası',
];

/** Tedarikçi tanımlama kartı — acil yardım uzmanlık alanları */
const VENDOR_ACIL_BRANCHES = [
  'Su Tesisatçısı',
  'Elektrikçi',
  'Konut Çilingir',
  'Araç Çilingir',
  'Cam Tamiri',
  'Çatı Onarım',
  'Beyaz Eşya Servisi',
  'Kombi / Klima Servisi',
  'Haşere İlaçlama',
  'Doğalgaz Tesisatçısı',
];

@Injectable()
export class ServiceBranchesService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(type?: string, scope?: string) {
    const where: { isActive?: boolean; type?: string; scope?: string | { in: string[] } } = {};
    if (type) where.type = type;
    const normalized = normalizeServiceBranchScope(scope);
    if (normalized === MERIDYEN_SCOPE) {
      where.scope = meridyenScopeFilter().scope;
    } else if (normalized) {
      where.scope = normalized;
    }
    return where;
  }

  async findAll(type?: string, scope?: string) {
    return this.prisma.serviceBranch.findMany({
      where: { ...this.buildWhere(type, scope), isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAllAdmin(type?: string, scope?: string) {
    return this.prisma.serviceBranch.findMany({
      where: this.buildWhere(type, scope),
      orderBy: [{ scope: 'asc' }, { type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: { name: string; type: string; scope?: string; sortOrder?: number }) {
    const scope = resolveCreateScope(data.scope);
    const existing = await this.prisma.serviceBranch.findFirst({
      where: { name: data.name, type: data.type, scope },
    });
    if (existing) throw new ConflictException('Bu kapsamda aynı isimde bir kayıt zaten mevcut');
    return this.prisma.serviceBranch.create({
      data: {
        name: data.name,
        type: data.type,
        scope,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; type?: string; scope?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const existing = await this.prisma.serviceBranch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kayıt bulunamadı');
    const nextScope = data.scope ? resolveCreateScope(data.scope) : existing.scope;
    const nextType = data.type ?? existing.type;
    if (data.name && data.name !== existing.name) {
      const conflict = await this.prisma.serviceBranch.findFirst({
        where: { name: data.name, type: nextType, scope: nextScope, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Bu kapsamda aynı isimde bir kayıt zaten mevcut');
    }
    return this.prisma.serviceBranch.update({
      where: { id },
      data: {
        ...data,
        scope: data.scope ? nextScope : undefined,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.serviceBranch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kayıt bulunamadı');
    await this.prisma.serviceBranch.delete({ where: { id } });
    return { message: 'Kayıt silindi' };
  }

  /** Meridyen hizmet branşları — varsayılan seed */
  async seed() {
    const existing = await this.prisma.serviceBranch.count({
      where: meridyenScopeFilter(),
    });
    if (existing > 0) return { message: 'Meridyen hizmet branşları zaten seed edilmiş', count: existing };

    const hasarData = MERIDYEN_HASAR_BRANCHES.map((name, i) => ({
      name,
      type: 'hasar',
      scope: MERIDYEN_SCOPE,
      sortOrder: i,
    }));
    const acilData = MERIDYEN_ACIL_BRANCHES.map((name, i) => ({
      name,
      type: 'acil_yardim',
      scope: MERIDYEN_SCOPE,
      sortOrder: i,
    }));

    await this.prisma.serviceBranch.createMany({ data: [...hasarData, ...acilData] });
    const count = await this.prisma.serviceBranch.count({ where: meridyenScopeFilter() });
    return { message: 'Meridyen hizmet branşları seed tamamlandı', count };
  }

  /** Tedarikçi acil hizmet kolları */
  async seedVendorAcil() {
    const existing = await this.prisma.serviceBranch.count({
      where: { scope: VENDOR_SCOPE, type: 'acil_yardim' },
    });
    if (existing > 0) return { message: 'Tedarikçi acil hizmet kolları zaten seed edilmiş', count: existing };

    const rows = VENDOR_ACIL_BRANCHES.map((name, i) => ({
      name,
      type: 'acil_yardim',
      scope: VENDOR_SCOPE,
      sortOrder: i,
    }));
    await this.prisma.serviceBranch.createMany({ data: rows });
    const count = await this.prisma.serviceBranch.count({
      where: { scope: VENDOR_SCOPE, type: 'acil_yardim' },
    });
    return { message: 'Tedarikçi acil hizmet kolları seed tamamlandı', count };
  }
}
