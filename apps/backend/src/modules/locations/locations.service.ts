import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async findAllProvinces() {
    return this.prisma.province.findMany({
      orderBy: { plateCode: 'asc' },
      select: { id: true, plateCode: true, name: true },
    });
  }

  async findDistrictsByProvince(provinceId: string) {
    return this.prisma.district.findMany({
      where: { provinceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, provinceId: true },
    });
  }
}
