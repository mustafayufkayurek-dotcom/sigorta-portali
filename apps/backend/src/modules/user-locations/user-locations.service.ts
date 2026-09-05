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

export type FieldMapActorType =
  | 'personel'
  | 'vendor_hasar'
  | 'vendor_acil'
  | 'file_hasar'
  | 'file_acil';

export type FieldMapJobStage = 'yeni' | 'atandi' | 'sahada';

export interface FieldMapPoint {
  actorType: FieldMapActorType;
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timestamp?: string;
  locationKind: 'live' | 'job';
  jobStage?: FieldMapJobStage;
  jobStageLabel?: string;
  activeJob?: { label: string; fileNo?: string; href?: string };
}

function isPlotCoord(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

/** Aynı iş adresindeki dosyalar üst üste binmesin (~10–20 m). */
function nudgeById(id: string, lat: number, lng: number): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const dLat = ((h % 17) - 8) * 0.00012;
  const dLng = (((h >> 4) % 17) - 8) * 0.00012;
  return { lat: lat + dLat, lng: lng + dLng };
}

function hasarJobStage(code?: string | null, hasVendor?: boolean): {
  stage: FieldMapJobStage;
  label: string;
} {
  const c = (code ?? '').toLowerCase();
  if (
    c.includes('repair_in_progress') ||
    c.includes('inspection') ||
    c.includes('field')
  ) {
    return { stage: 'sahada', label: 'Sahada' };
  }
  if (c.includes('supplier_assigned') || c.includes('repair_planning') || hasVendor) {
    return { stage: 'atandi', label: 'Atandı' };
  }
  return { stage: 'yeni', label: 'Yeni ihbar' };
}

function acilJobStage(status: string): { stage: FieldMapJobStage; label: string } {
  if (status === 'SAHADA') return { stage: 'sahada', label: 'Sahada' };
  if (status === 'ATANDI') return { stage: 'atandi', label: 'Atandı' };
  return { stage: 'yeni', label: 'Yeni ihbar' };
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

  async getFieldMap(): Promise<FieldMapPoint[]> {
    const personnel = await this.getLatestAll();
    const points: FieldMapPoint[] = personnel.map((p) => {
      const ts = p.lastLocation.timestamp;
      return {
        actorType: 'personel',
        id: p.userId,
        name: `${p.firstName} ${p.lastName}`.trim(),
        latitude: p.lastLocation.latitude,
        longitude: p.lastLocation.longitude,
        timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
        locationKind: 'live',
        activeJob: p.activeAppointment
          ? {
              label: p.activeAppointment.type,
              fileNo: p.activeAppointment.claimFile?.fileNo,
            }
          : undefined,
      };
    });

    const [claimFiles, emergencyCases] = await Promise.all([
      this.prisma.claimFile.findMany({
        where: {
          currentStatus: { isClosedState: false },
          OR: [
            { propertyAddress: { latitude: { not: null }, longitude: { not: null } } },
            { customer: { latitude: { not: null }, longitude: { not: null } } },
          ],
        },
        take: 400,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          fileNo: true,
          updatedAt: true,
          assignedSupplierId: true,
          currentStatus: { select: { code: true, name: true } },
          assignedSupplier: { select: { name: true } },
          propertyAddress: { select: { latitude: true, longitude: true } },
          customer: { select: { latitude: true, longitude: true } },
        },
      }),
      this.prisma.emergencyCase.findMany({
        where: {
          status: { in: ['GELEN', 'ATANDI', 'SAHADA'] },
          latitude: { not: null },
          longitude: { not: null },
        },
        take: 400,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          caseNo: true,
          fileNo: true,
          status: true,
          latitude: true,
          longitude: true,
          updatedAt: true,
          assignedVendor: { select: { name: true } },
        },
      }),
    ]);

    for (const cf of claimFiles) {
      const lat = cf.propertyAddress?.latitude ?? cf.customer?.latitude ?? null;
      const lng = cf.propertyAddress?.longitude ?? cf.customer?.longitude ?? null;
      if (!isPlotCoord(lat, lng)) continue;
      const pos = nudgeById(cf.id, lat!, lng!);
      const stage = hasarJobStage(cf.currentStatus?.code, Boolean(cf.assignedSupplierId));
      const vendor = cf.assignedSupplier?.name;
      points.push({
        actorType: 'file_hasar',
        id: `file_hasar__${cf.id}`,
        name: cf.fileNo,
        latitude: pos.lat,
        longitude: pos.lng,
        timestamp: cf.updatedAt.toISOString(),
        locationKind: 'job',
        jobStage: stage.stage,
        jobStageLabel: cf.currentStatus?.name || stage.label,
        activeJob: {
          label: vendor ? `Hasar · ${vendor}` : 'Hasar Dosyası',
          fileNo: cf.fileNo,
          href: `/panel/hasar-dosyalari/${cf.id}`,
        },
      });
    }

    for (const ec of emergencyCases) {
      if (!isPlotCoord(ec.latitude, ec.longitude)) continue;
      const fileNo = ec.fileNo ?? ec.caseNo;
      const pos = nudgeById(ec.id, ec.latitude!, ec.longitude!);
      const stage = acilJobStage(ec.status);
      const vendor = ec.assignedVendor?.name;
      points.push({
        actorType: 'file_acil',
        id: `file_acil__${ec.id}`,
        name: fileNo,
        latitude: pos.lat,
        longitude: pos.lng,
        timestamp: ec.updatedAt.toISOString(),
        locationKind: 'job',
        jobStage: stage.stage,
        jobStageLabel: stage.label,
        activeJob: {
          label: vendor ? `Acil · ${vendor}` : 'Acil Yardım Dosyası',
          fileNo,
          href: `/panel/acil-yardim/${ec.id}`,
        },
      });
    }

    return points;
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
