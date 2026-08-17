import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SmsService } from '@/modules/notifications/sms/sms.service';

@Injectable()
export class AdjustersService {
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
  ) {}

  async findAll(params?: {
    page?: number;
    limit?: number;
    city?: string;
    region?: string;
    status?: string;
    search?: string;
  }) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.city) where.city = { contains: params.city, mode: 'insensitive' };
    if (params?.region) where.region = { contains: params.region, mode: 'insensitive' };
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { company: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.adjuster.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: { select: { assignments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adjuster.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const adjuster = await this.prisma.adjuster.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            claimFile: { select: { id: true, fileNo: true, claimNo: true, productBranch: true, lossType: true } },
            report: true,
          },
          orderBy: { assignedAt: 'desc' },
          take: 20,
        },
        appointments: {
          include: {
            claimFile: { select: { id: true, fileNo: true } },
          },
          orderBy: { scheduledAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!adjuster) throw new NotFoundException('Eksper bulunamadı');
    return adjuster;
  }

  async create(data: any) {
    return this.prisma.adjuster.create({ data });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.adjuster.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.adjuster.delete({ where: { id } });
    return { message: 'Eksper silindi' };
  }

  async getPerformanceMetrics(id: string) {
    await this.findOne(id);

    const assignments = await this.prisma.adjusterAssignment.findMany({
      where: { adjusterId: id },
      include: { report: true },
    });

    const total = assignments.length;
    const completed = assignments.filter((a) => a.status === 'completed').length;
    const pending = assignments.filter((a) => a.status === 'pending').length;
    const accepted = assignments.filter((a) => a.status === 'accepted').length;

    const reportsAll = assignments.filter((a) => a.report !== null).map((a) => a.report!);
    const totalReports = reportsAll.length;
    const rejectedReports = reportsAll.filter((r) => r.status === 'rejected').length;
    const revisionRate = totalReports > 0 ? Math.round((rejectedReports / totalReports) * 100) : 0;

    // Ortalama rapor dönüş süresi (atama → rapor tarihi)
    let avgReportDays = 0;
    const reportDays: number[] = [];
    for (const a of assignments) {
      if (a.report?.reportDate) {
        const diff = (new Date(a.report.reportDate).getTime() - new Date(a.assignedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (diff >= 0) reportDays.push(diff);
      }
    }
    if (reportDays.length > 0) {
      avgReportDays = Math.round(reportDays.reduce((s, d) => s + d, 0) / reportDays.length);
    }

    // Performans skoru (kapanış hızı %40, revizyon düşüklüğü %30, tamamlanma oranı %30)
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    const revisionScore = Math.max(0, 100 - revisionRate);
    const speedScore = avgReportDays > 0 ? Math.max(0, 100 - avgReportDays * 2) : 100;
    const performanceScore = Math.round(speedScore * 0.4 + revisionScore * 0.3 + completionRate * 0.3);

    return {
      total,
      completed,
      pending,
      accepted,
      totalReports,
      rejectedReports,
      revisionRate,
      avgReportDays,
      completionRate: Math.round(completionRate),
      performanceScore,
    };
  }

  async getAllPerformanceMetrics(filters?: { city?: string; region?: string }) {
    const where: any = { status: 'active' };
    if (filters?.city) where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters?.region) where.region = { contains: filters.region, mode: 'insensitive' };

    const adjusters = await this.prisma.adjuster.findMany({
      where,
      include: {
        assignments: { include: { report: true } },
      },
    });

    return adjusters.map((adj) => {
      const total = adj.assignments.length;
      const completed = adj.assignments.filter((a) => a.status === 'completed').length;
      const reports = adj.assignments.filter((a) => a.report).map((a) => a.report!);
      const totalReports = reports.length;
      const rejectedReports = reports.filter((r) => r.status === 'rejected').length;
      const revisionRate = totalReports > 0 ? Math.round((rejectedReports / totalReports) * 100) : 0;

      const reportDays: number[] = [];
      for (const a of adj.assignments) {
        if (a.report?.reportDate) {
          const diff = (new Date(a.report.reportDate).getTime() - new Date(a.assignedAt).getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0) reportDays.push(diff);
        }
      }
      const avgReportDays = reportDays.length > 0 ? Math.round(reportDays.reduce((s, d) => s + d, 0) / reportDays.length) : 0;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;
      const revisionScore = Math.max(0, 100 - revisionRate);
      const speedScore = avgReportDays > 0 ? Math.max(0, 100 - avgReportDays * 2) : 100;
      const performanceScore = Math.round(speedScore * 0.4 + revisionScore * 0.3 + completionRate * 0.3);

      return {
        id: adj.id,
        name: adj.name,
        company: adj.company,
        city: adj.city,
        region: adj.region,
        total,
        completed,
        pending: adj.assignments.filter((a) => a.status === 'pending').length,
        totalReports,
        revisionRate,
        avgReportDays,
        completionRate: Math.round(completionRate),
        performanceScore,
      };
    }).sort((a, b) => b.performanceScore - a.performanceScore);
  }

  async suggestByRegionAndBranch(region: string, branch: string) {
    const adjusters = await this.prisma.adjuster.findMany({
      where: {
        status: 'active',
        OR: [
          { region: { contains: region, mode: 'insensitive' } },
          { city: { contains: region, mode: 'insensitive' } },
        ],
      },
      include: { _count: { select: { assignments: true } } },
    });

    // Uzmanlık alanına göre filtrele ve iş yüküne göre sırala
    const filtered = adjusters.filter(
      (a) => a.specialties.length === 0 || a.specialties.some((s) => s.toLowerCase().includes(branch.toLowerCase())),
    );

    return filtered
      .sort((a, b) => (a._count?.assignments ?? 0) - (b._count?.assignments ?? 0))
      .slice(0, 5);
  }

  // ── Atama yönetimi ──────────────────────────────────────────────────────────

  async createAssignment(claimFileId: string, dto: { adjusterId: string; notes?: string; appointmentDate?: string }) {
    const adjuster = await this.prisma.adjuster.findUnique({ where: { id: dto.adjusterId } });
    if (!adjuster) throw new NotFoundException('Eksper bulunamadı');

    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    return this.prisma.adjusterAssignment.create({
      data: {
        claimFileId,
        adjusterId: dto.adjusterId,
        notes: dto.notes,
        appointmentDate: dto.appointmentDate ? new Date(dto.appointmentDate) : undefined,
      },
      include: {
        adjuster: true,
        claimFile: { select: { id: true, fileNo: true, claimNo: true } },
      },
    });
  }

  async respondToAssignment(assignmentId: string, dto: { status: 'accepted' | 'rejected'; notes?: string; appointmentDate?: string }) {
    const assignment = await this.prisma.adjusterAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Atama bulunamadı');
    if (assignment.status !== 'pending') throw new BadRequestException('Bu atamaya yanıt verilemez');

    return this.prisma.adjusterAssignment.update({
      where: { id: assignmentId },
      data: {
        status: dto.status,
        respondedAt: new Date(),
        notes: dto.notes,
        appointmentDate: dto.appointmentDate ? new Date(dto.appointmentDate) : undefined,
      },
      include: { adjuster: true },
    });
  }

  async getAssignmentsByClaimFile(claimFileId: string) {
    return this.prisma.adjusterAssignment.findMany({
      where: { claimFileId },
      include: {
        adjuster: true,
        report: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // ── Rapor yönetimi ──────────────────────────────────────────────────────────

  async createReport(assignmentId: string, dto: {
    reportNo: string;
    reportDate: string;
    recommendation?: string;
    estimatedDamage?: number;
    fileAssetId?: string;
  }) {
    const assignment = await this.prisma.adjusterAssignment.findUnique({
      where: { id: assignmentId },
      include: { report: true },
    });
    if (!assignment) throw new NotFoundException('Atama bulunamadı');
    if (assignment.status !== 'accepted') throw new BadRequestException('Atama kabul edilmeden rapor girilemez');
    if (assignment.report) throw new BadRequestException('Bu atama için zaten bir rapor mevcut');

    return this.prisma.adjusterReport.create({
      data: {
        assignmentId,
        reportNo: dto.reportNo,
        reportDate: new Date(dto.reportDate),
        recommendation: dto.recommendation,
        estimatedDamage: dto.estimatedDamage,
        fileAssetId: dto.fileAssetId,
        status: 'submitted',
      },
    });
  }

  async reviewReport(reportId: string, dto: { status: 'approved' | 'rejected'; rejectionReason?: string }) {
    const report = await this.prisma.adjusterReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    if (report.status !== 'submitted') throw new BadRequestException('Rapor onay/red için uygun durumda değil');
    if (dto.status === 'rejected' && !dto.rejectionReason) {
      throw new BadRequestException('Red sebebi girilmelidir');
    }

    const [updatedReport] = await this.prisma.$transaction([
      this.prisma.adjusterReport.update({
        where: { id: reportId },
        data: { status: dto.status, rejectionReason: dto.rejectionReason },
      }),
      ...(dto.status === 'approved'
        ? [this.prisma.adjusterAssignment.update({
            where: { id: report.assignmentId },
            data: { status: 'completed', visitDate: new Date() },
          })]
        : []),
    ]);

    return updatedReport;
  }

  // ── Randevu yönetimi ────────────────────────────────────────────────────────

  async createAppointment(claimFileId: string, dto: {
    adjusterId?: string;
    assignedUserId?: string;
    vendorId?: string;
    type: string;
    scheduledAt: string;
    scheduledEnd?: string;
    location?: string;
    notes?: string;
  }) {
    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    return this.prisma.appointment.create({
      data: {
        claimFileId,
        adjusterId: dto.adjusterId,
        assignedUserId: dto.assignedUserId,
        vendorId: dto.vendorId,
        type: dto.type,
        scheduledAt: new Date(dto.scheduledAt),
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : null,
        location: dto.location,
        notes: dto.notes,
        status: 'planned',
      },
      include: {
        adjuster: true,
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        vendor: { select: { id: true, name: true, phone: true } },
        claimFile: { select: { id: true, fileNo: true } },
      },
    });
  }

  async updateAppointmentStatus(id: string, status: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException('Randevu bulunamadı');

    const validTransitions: Record<string, string[]> = {
      planned: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    const allowed = validTransitions[appointment.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`'${appointment.status}' durumundan '${status}' durumuna geçiş yapılamaz`);
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
      },
      include: {
        adjuster: true,
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        vendor: { select: { id: true, name: true, phone: true } },
        claimFile: { select: { id: true, fileNo: true } },
      },
    });
  }

  async getAppointmentsByClaimFile(claimFileId: string) {
    return this.prisma.appointment.findMany({
      where: { claimFileId },
      include: {
        adjuster: true,
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        vendor: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getAppointmentsByUser(assignedUserId: string, params?: { from?: string; to?: string }) {
    const where: any = { assignedUserId };
    if (params?.from || params?.to) {
      where.scheduledAt = {};
      if (params.from) where.scheduledAt.gte = new Date(params.from);
      if (params.to) where.scheduledAt.lte = new Date(params.to);
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        adjuster: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        vendor: { select: { id: true, name: true } },
        claimFile: { select: { id: true, fileNo: true, claimNo: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getCalendar(params?: { from?: string; to?: string; adjusterId?: string; assignedUserId?: string }) {
    const where: any = {};
    if (params?.adjusterId) where.adjusterId = params.adjusterId;
    if (params?.assignedUserId) where.assignedUserId = params.assignedUserId;
    if (params?.from || params?.to) {
      where.scheduledAt = {};
      if (params.from) where.scheduledAt.gte = new Date(params.from);
      if (params.to) where.scheduledAt.lte = new Date(params.to);
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        adjuster: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        vendor: { select: { id: true, name: true } },
        claimFile: { select: { id: true, fileNo: true, claimNo: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async sendAppointmentNotification(
    appointmentId: string,
    channel: 'sms' | 'whatsapp',
    requestingUserId: string,
  ): Promise<{ success: boolean; waUrl?: string; message: string }> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        claimFile: {
          include: {
            customer: true,
            propertyAddress: true,
          },
        },
        vendor: true,
        assignedUser: true,
      },
    });

    if (!appointment) throw new NotFoundException('Randevu bulunamadı');

    const dateStr = new Date(appointment.scheduledAt).toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    const timeStr = new Date(appointment.scheduledAt).toLocaleTimeString('tr-TR', {
      hour: '2-digit', minute: '2-digit',
    });
    const address = appointment.location
      ?? appointment.claimFile.propertyAddress?.addressLine
      ?? 'Belirtilmemiş';
    const customerName =
      appointment.claimFile.customer?.fullName ??
      appointment.claimFile.customer?.companyName ??
      'Sigortalı';
    const fileNo = appointment.claimFile.fileNo;

    const customerMsg = `Sayın ${customerName}, ${dateStr} tarihinde ${timeStr} saatinde randevunuz planlanmıştır. Adres: ${address}`;
    const vendorMsg = `${fileNo} nolu dosya için ${dateStr} ${timeStr} saatinde saha ziyareti randevusu oluşturulmuştur. Adres: ${address}`;

    if (channel === 'sms') {
      const customerPhone = appointment.claimFile.customer?.phone;
      if (customerPhone) {
        await this.smsService.send(requestingUserId, customerPhone, customerMsg, 'appointment_sms', appointmentId);
      }
      if (appointment.vendor?.phone) {
        await this.smsService.send(requestingUserId, appointment.vendor.phone, vendorMsg, 'appointment_sms', appointmentId);
      }
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { notifiedAt: new Date() },
      });
      return { success: true, message: 'SMS bildirimleri gönderildi' };
    } else {
      // WhatsApp: müşteri için deep link döndür
      const waUrl = this.smsService.buildWhatsAppUrl(
        appointment.claimFile.customer?.phone ?? undefined,
        customerMsg,
      );
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { notifiedAt: new Date() },
      });
      return { success: true, waUrl, message: 'WhatsApp linki oluşturuldu' };
    }
  }

  private static haversineMeters(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
  ): number {
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async checkIn(appointmentId: string, _userId: string, latitude: number, longitude: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        claimFile: {
          include: { propertyAddress: true },
        },
      },
    });
    if (!appointment) throw new NotFoundException('Randevu bulunamadı');

    let withinRange = false;
    let distanceMeters: number | null = null;

    const addr = appointment.claimFile?.propertyAddress;
    if (addr?.latitude != null && addr?.longitude != null) {
      distanceMeters = Math.round(
        AdjustersService.haversineMeters(addr.latitude, addr.longitude, latitude, longitude),
      );
      withinRange = distanceMeters <= 200;
    }

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        checkedInAt: new Date(),
        checkedInLatitude: latitude,
        checkedInLongitude: longitude,
      },
    });

    return { withinRange, distanceMeters };
  }

  async checkOut(appointmentId: string, _userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) throw new NotFoundException('Randevu bulunamadı');
    if (!appointment.checkedInAt) {
      throw new BadRequestException('Önce check-in yapılmalıdır');
    }

    const now = new Date();
    const durationMinutes = Math.round(
      (now.getTime() - appointment.checkedInAt.getTime()) / 60_000,
    );

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { checkedOutAt: now },
    });

    return { durationMinutes };
  }
}
