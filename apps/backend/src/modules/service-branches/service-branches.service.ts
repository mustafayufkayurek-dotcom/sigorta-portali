import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mapFileSubjectToMeridyenBranch,
  MeridyenServiceBranchView,
} from '@/common/utils/file-subject-meridyen-branch';
import {
  MERIDYEN_SCOPE,
  VENDOR_SCOPE,
  meridyenScopeFilter,
  normalizeServiceBranchScope,
  resolveCreateScope,
} from './service-branch-scope';

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

const MERIDYEN_WRITE_MESSAGE =
  'Meridyen operasyon branşları artık Ayarlar → Dosya Konuları ekranından yönetilir.';

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

  private isMeridyenScope(scope?: string | null): boolean {
    return normalizeServiceBranchScope(scope) === MERIDYEN_SCOPE;
  }

  private async findMeridyenFromFileSubjects(
    type?: string,
    activeOnly = true,
  ): Promise<MeridyenServiceBranchView[]> {
    const subjects = await this.prisma.departmentFileSubject.findMany({
      where: {
        department: { status: 'active' },
        ...(activeOnly ? { status: 'active' } : {}),
      },
      include: { department: { select: { code: true, reportFormat: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    let mapped = subjects.map((subject) =>
      mapFileSubjectToMeridyenBranch(subject, subject.department),
    );
    if (type) {
      mapped = mapped.filter((branch) => branch.type === type);
    }
    return mapped;
  }

  private rejectMeridyenWrite(): never {
    throw new BadRequestException(MERIDYEN_WRITE_MESSAGE);
  }

  async findAll(type?: string, scope?: string) {
    if (this.isMeridyenScope(scope)) {
      return this.findMeridyenFromFileSubjects(type, true);
    }
    return this.prisma.serviceBranch.findMany({
      where: { ...this.buildWhere(type, scope), isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAllAdmin(type?: string, scope?: string) {
    if (this.isMeridyenScope(scope)) {
      return this.findMeridyenFromFileSubjects(type, false);
    }
    return this.prisma.serviceBranch.findMany({
      where: this.buildWhere(type, scope),
      orderBy: [{ scope: 'asc' }, { type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: { name: string; type: string; scope?: string; sortOrder?: number }) {
    const scope = resolveCreateScope(data.scope);
    if (scope === MERIDYEN_SCOPE) {
      this.rejectMeridyenWrite();
    }
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
    const fileSubject = await this.prisma.departmentFileSubject.findUnique({ where: { id } });
    if (fileSubject) {
      this.rejectMeridyenWrite();
    }

    const existing = await this.prisma.serviceBranch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kayıt bulunamadı');
    if (this.isMeridyenScope(existing.scope)) {
      this.rejectMeridyenWrite();
    }

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
    const fileSubject = await this.prisma.departmentFileSubject.findUnique({ where: { id } });
    if (fileSubject) {
      this.rejectMeridyenWrite();
    }

    const existing = await this.prisma.serviceBranch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kayıt bulunamadı');
    if (this.isMeridyenScope(existing.scope)) {
      this.rejectMeridyenWrite();
    }
    await this.prisma.serviceBranch.delete({ where: { id } });
    return { message: 'Kayıt silindi' };
  }

  /** @deprecated Meridyen branşları artık departman dosya konularından okunur */
  async seed() {
    const count = await this.findMeridyenFromFileSubjects(undefined, false);
    return {
      message: 'Meridyen branşları Dosya Konuları ekranından yönetilir; mevcut konu sayısı döndürüldü',
      count: count.length,
    };
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
