import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class InsuranceCompaniesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: { page?: number; limit?: number; status?: string }) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.insuranceCompany.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.insuranceCompany.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const company = await this.prisma.insuranceCompany.findUnique({
      where: { id },
    });
    if (!company) {
      throw new NotFoundException('Sigorta şirketi bulunamadı');
    }
    return company;
  }

  private async generateCode(name: string): Promise<string> {
    // Şirket adından slug üret: "Güven Sigorta A.Ş." → "GUVEN_SIGORTA"
    const slug = name
      .toUpperCase()
      .replace(/[ÇçĞğİıÖöŞşÜü]/g, (c) =>
        ({ Ç: 'C', ç: 'C', Ğ: 'G', ğ: 'G', İ: 'I', ı: 'I', Ö: 'O', ö: 'O', Ş: 'S', ş: 'S', Ü: 'U', ü: 'U' }[c] ?? c),
      )
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 20);

    // Benzersizliği kontrol et, çakışırsa sıra no ekle
    let candidate = slug;
    let attempt = 0;
    while (true) {
      const existing = await this.prisma.insuranceCompany.findUnique({ where: { code: candidate } });
      if (!existing) return candidate;
      attempt++;
      candidate = `${slug}_${attempt}`;
    }
  }

  async create(data: any) {
    const { code: _ignored, ...rest } = data;
    const nameConflict = await this.prisma.insuranceCompany.findFirst({
      where: { name: rest.name },
    });
    if (nameConflict) throw new ConflictException('Bu isimde bir sigorta şirketi zaten mevcut');
    const code = await this.generateCode(rest.name ?? 'SIRKET');
    return this.prisma.insuranceCompany.create({ data: { ...rest, code } });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    if (data.name) {
      const conflict = await this.prisma.insuranceCompany.findFirst({
        where: { name: data.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Bu isimde bir sigorta şirketi zaten mevcut');
    }
    return this.prisma.insuranceCompany.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.insuranceCompany.delete({ where: { id } });
    return { message: 'Sigorta şirketi silindi' };
  }
}
