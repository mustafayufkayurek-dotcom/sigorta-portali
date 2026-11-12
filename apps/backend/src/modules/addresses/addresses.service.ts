import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { readOpenAddressPlace } from '@sigorta/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { PROVINCES } from '@/common/data/turkey-locations';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: { page?: number; limit?: number; city?: string }) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.city) where.city = params.city;

    const [data, total] = await Promise.all([
      this.prisma.address.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.address.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) {
      throw new NotFoundException('Adres bulunamadı');
    }
    return address;
  }

  async create(data: any) {
    this.assertPlace(data);
    return this.prisma.address.create({ data });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    this.assertPlace(data);
    return this.prisma.address.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.address.delete({ where: { id } });
    return { message: 'Adres silindi' };
  }

  private assertPlace(data: { addressLine?: string | null; city?: string | null; district?: string | null }) {
    if (data.addressLine == null && data.city == null && data.district == null) return;
    const place = readOpenAddressPlace(data.addressLine || '', PROVINCES, {
      city: data.city,
      district: data.district,
    });
    if (place.conflict) throw new BadRequestException(place.conflict);
  }
}
