import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { compactFileNo } from '@sigorta/shared';
import {
  findClaimFileIdByCompactFileNo,
  findEmergencyCaseIdByCompactFileNo,
} from '@/common/utils/file-no-helpers';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  category: 'dosyalar' | 'acil_dosyalar' | 'mailler' | 'musteriler' | 'tedarikciler' | 'eksperler' | 'faturalar';
}

export interface SearchResults {
  dosyalar: SearchResultItem[];
  acil_dosyalar: SearchResultItem[];
  mailler: SearchResultItem[];
  musteriler: SearchResultItem[];
  tedarikciler: SearchResultItem[];
  eksperler: SearchResultItem[];
  faturalar: SearchResultItem[];
  total: number;
}

const LIMIT = 5;

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async globalSearch(query: string, userId: string, roleCode: string): Promise<SearchResults> {
    const q = (query ?? '').trim();
    const empty: SearchResults = {
      dosyalar: [],
      acil_dosyalar: [],
      mailler: [],
      musteriler: [],
      tedarikciler: [],
      eksperler: [],
      faturalar: [],
      total: 0,
    };
    if (q.length < 2) {
      return empty;
    }

    const role = String(roleCode ?? '').trim().toLowerCase();
    const isFieldStaff = role === 'field_staff' || roleCode === 'FIELD_STAFF';
    const canSearchInbox = !isFieldStaff && role !== 'expert' && role !== 'insurance_company_user';

    const claimFileOr: Record<string, unknown>[] = [
      { fileNo: { contains: q, mode: 'insensitive' } },
      { claimNo: { contains: q, mode: 'insensitive' } },
      { policyNo: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { insuredName: { contains: q, mode: 'insensitive' } },
      { insuredPhone: { contains: q, mode: 'insensitive' } },
      { commercialTitle: { contains: q, mode: 'insensitive' } },
      { customer: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
      { customer: { is: { firstName: { contains: q, mode: 'insensitive' } } } },
      { customer: { is: { lastName: { contains: q, mode: 'insensitive' } } } },
      { customer: { is: { companyName: { contains: q, mode: 'insensitive' } } } },
      { customer: { is: { phone: { contains: q, mode: 'insensitive' } } } },
    ];

    const [claimFiles, emergencyCases, inboundMessages, customers, vendors, adjusters, invoices] = await Promise.all([
      // Hasar Dosyaları
      this.prisma.claimFile.findMany({
        where: {
          AND: [
            isFieldStaff ? { assignedFieldUserId: userId } : {},
            { OR: claimFileOr },
          ],
        },
        select: {
          id: true,
          fileNo: true,
          description: true,
          insuredName: true,
          customer: { select: { fullName: true, companyName: true } },
          currentStatus: { select: { name: true } },
        },
        take: LIMIT,
        orderBy: { updatedAt: 'desc' },
      }),

      // Acil Yardım Dosyaları
      isFieldStaff
        ? Promise.resolve([])
        : this.prisma.emergencyCase.findMany({
            where: {
              OR: [
                { fileNo: { contains: q, mode: 'insensitive' } },
                { caseNo: { contains: q, mode: 'insensitive' } },
                { customerName: { contains: q, mode: 'insensitive' } },
                { customerPhone: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
                { issueType: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              fileNo: true,
              caseNo: true,
              customerName: true,
              status: true,
            },
            take: LIMIT,
            orderBy: { updatedAt: 'desc' },
          }),

      // Gelen Kutusu (e-posta)
      canSearchInbox
        ? this.prisma.inboundMessage.findMany({
            where: {
              OR: [
                { subject: { contains: q, mode: 'insensitive' } },
                { fromName: { contains: q, mode: 'insensitive' } },
                { fromAddress: { contains: q, mode: 'insensitive' } },
                { bodyPreview: { contains: q, mode: 'insensitive' } },
                { bodyText: { contains: q, mode: 'insensitive' } },
                { aiSummary: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              subject: true,
              fromName: true,
              fromAddress: true,
              receivedAt: true,
              mailbox: true,
              claimFile: { select: { fileNo: true } },
              emergencyCase: { select: { fileNo: true } },
            },
            take: LIMIT,
            orderBy: { receivedAt: 'desc' },
          })
        : Promise.resolve([]),

      // Müşteriler
      isFieldStaff
        ? Promise.resolve([])
        : this.prisma.customer.findMany({
            where: {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { companyName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { taxNumber: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, fullName: true, firstName: true, lastName: true, companyName: true, phone: true, email: true },
            take: LIMIT,
            orderBy: { updatedAt: 'desc' },
          }),

      // Tedarikçiler
      isFieldStaff
        ? Promise.resolve([])
        : this.prisma.vendor.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { authorizedPerson: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, name: true, authorizedPerson: true, phone: true },
            take: LIMIT,
            orderBy: { updatedAt: 'desc' },
          }),

      // Eksperler
      isFieldStaff
        ? Promise.resolve([])
        : this.prisma.adjuster.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { licenseNo: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, name: true, phone: true, licenseNo: true },
            take: LIMIT,
            orderBy: { updatedAt: 'desc' },
          }),

      // Faturalar
      isFieldStaff
        ? Promise.resolve([])
        : this.prisma.invoice.findMany({
            where: {
              OR: [
                { invoiceNo: { contains: q, mode: 'insensitive' } },
                { claimFile: { is: { fileNo: { contains: q, mode: 'insensitive' } } } },
              ],
            },
            select: {
              id: true,
              invoiceNo: true,
              totalAmount: true,
              claimFile: { select: { fileNo: true } },
            },
            take: LIMIT,
            orderBy: { updatedAt: 'desc' },
          }),
    ]);

    const claimSelect = {
      id: true,
      fileNo: true,
      description: true,
      insuredName: true,
      customer: { select: { fullName: true, companyName: true } },
      currentStatus: { select: { name: true } },
    } as const;

    const compactQ = compactFileNo(q);
    if (compactQ.length >= 2) {
      const [compactClaimId, compactEmergencyId] = await Promise.all([
        findClaimFileIdByCompactFileNo(this.prisma, q),
        isFieldStaff ? Promise.resolve(null) : findEmergencyCaseIdByCompactFileNo(this.prisma, q),
      ]);

      if (compactClaimId && !(claimFiles as { id: string }[]).some((f) => f.id === compactClaimId)) {
        const extra = await this.prisma.claimFile.findFirst({
          where: {
            AND: [
              { id: compactClaimId },
              isFieldStaff ? { assignedFieldUserId: userId } : {},
            ],
          },
          select: claimSelect,
        });
        if (extra) (claimFiles as unknown[]).unshift(extra);
      }

      if (
        compactEmergencyId
        && !(emergencyCases as { id: string }[]).some((c) => c.id === compactEmergencyId)
      ) {
        const extraEmergency = await this.prisma.emergencyCase.findUnique({
          where: { id: compactEmergencyId },
          select: {
            id: true,
            fileNo: true,
            caseNo: true,
            customerName: true,
            status: true,
          },
        });
        if (extraEmergency) (emergencyCases as unknown[]).unshift(extraEmergency);
      }
    }

    const dosyalarMapped: SearchResultItem[] = (claimFiles as any[]).slice(0, LIMIT).map((f) => ({
      id: f.id,
      title: f.fileNo,
      subtitle: [f.insuredName, f.customer?.fullName ?? f.customer?.companyName, f.currentStatus?.name].filter(Boolean).join(' · '),
      url: `/panel/hasar-dosyalari/${f.id}`,
      category: 'dosyalar' as const,
    }));

    const acilDosyalarMapped: SearchResultItem[] = (emergencyCases as any[]).slice(0, LIMIT).map((c) => ({
      id: c.id,
      title: c.fileNo ?? c.caseNo,
      subtitle: [c.customerName, c.status].filter(Boolean).join(' · '),
      url: `/panel/acil-yardim/${c.id}`,
      category: 'acil_dosyalar' as const,
    }));

    const maillerMapped: SearchResultItem[] = (inboundMessages as any[]).map((m) => ({
      id: m.id,
      title: m.subject || '(Konu yok)',
      subtitle: [
        m.fromName ?? m.fromAddress,
        m.claimFile?.fileNo ?? m.emergencyCase?.fileNo,
        m.receivedAt ? new Date(m.receivedAt).toLocaleDateString('tr-TR') : null,
      ].filter(Boolean).join(' · '),
      url: `/panel/operasyon/gelen-kutusu?messageId=${m.id}`,
      category: 'mailler' as const,
    }));

    const musterilerMapped: SearchResultItem[] = (customers as any[]).map((c) => ({
      id: c.id,
      title: c.fullName ?? c.companyName ?? [c.firstName, c.lastName].filter(Boolean).join(' ') ?? '—',
      subtitle: c.phone ?? c.email ?? '',
      url: `/panel/musteriler/${c.id}`,
      category: 'musteriler' as const,
    }));

    const tedarikcilerMapped: SearchResultItem[] = (vendors as any[]).map((v) => ({
      id: v.id,
      title: v.name,
      subtitle: v.authorizedPerson ?? v.phone ?? '',
      url: `/panel/tedarikciler/${v.id}`,
      category: 'tedarikciler' as const,
    }));

    const eksperlerMapped: SearchResultItem[] = (adjusters as any[]).map((a) => ({
      id: a.id,
      title: a.name,
      subtitle: a.licenseNo ? `Lisans: ${a.licenseNo}` : (a.phone ?? ''),
      url: `/panel/eksperler/${a.id}`,
      category: 'eksperler' as const,
    }));

    const faturalarMapped: SearchResultItem[] = (invoices as any[]).map((i) => ({
      id: i.id,
      title: i.invoiceNo,
      subtitle: [i.claimFile?.fileNo, i.totalAmount ? `₺${Number(i.totalAmount).toLocaleString('tr-TR')}` : null]
        .filter(Boolean)
        .join(' · '),
      url: `/panel/finans/faturalar/${i.id}`,
      category: 'faturalar' as const,
    }));

    const total =
      dosyalarMapped.length +
      acilDosyalarMapped.length +
      maillerMapped.length +
      musterilerMapped.length +
      tedarikcilerMapped.length +
      eksperlerMapped.length +
      faturalarMapped.length;

    return {
      dosyalar: dosyalarMapped,
      acil_dosyalar: acilDosyalarMapped,
      mailler: maillerMapped,
      musteriler: musterilerMapped,
      tedarikciler: tedarikcilerMapped,
      eksperler: eksperlerMapped,
      faturalar: faturalarMapped,
      total,
    };
  }
}
