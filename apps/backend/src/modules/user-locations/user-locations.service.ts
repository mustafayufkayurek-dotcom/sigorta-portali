import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  timestamp: string;
}

@Injectable()
export class UserLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async bulkCreate(userId: string, locations: LocationPoint[]) {
    const data = locations.map((l) => ({
      userId,
      latitude: l.latitude,
      longitude: l.longitude,
      accuracy: l.accuracy ?? null,
      altitude: l.altitude ?? null,
      speed: l.speed ?? null,
      heading: l.heading ?? null,
      batteryLevel: l.batteryLevel ?? null,
      timestamp: new Date(l.timestamp),
    }));

    await this.prisma.userLocation.createMany({ data });
    return { inserted: data.length };
  }

  async getLatestAll() {
    // Her kullanıcı için en son konum kaydını çek
    const users = await this.prisma.user.findMany({
      where: { isMobileUser: true, status: 'active' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: { select: { code: true, name: true } },
        userLocations: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: {
            id: true,
            latitude: true,
            longitude: true,
            accuracy: true,
            speed: true,
            batteryLevel: true,
            timestamp: true,
            createdAt: true,
          },
        },
        assignedAppointments: {
          where: { status: { in: ['planned', 'scheduled'] } },
          take: 1,
          select: {
            id: true,
            type: true,
            scheduledAt: true,
            location: true,
            claimFile: { select: { fileNo: true } },
          },
        },
      },
    });

    return users
      .filter((u) => u.userLocations.length > 0)
      .map((u) => ({
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        lastLocation: u.userLocations[0],
        activeAppointment: u.assignedAppointments[0] ?? null,
      }));
  }

  async getLatestByUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const location = await this.prisma.userLocation.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    });

    return { user, location };
  }

  async getHistory(userId: string, from?: string, to?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const where: any = { userId };
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    const locations = await this.prisma.userLocation.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        speed: true,
        heading: true,
        batteryLevel: true,
        timestamp: true,
      },
    });

    return { user, locations };
  }

  async cleanOldLocations(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const result = await this.prisma.userLocation.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
