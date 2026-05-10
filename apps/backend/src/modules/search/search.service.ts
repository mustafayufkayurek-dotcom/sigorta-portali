import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  category: 'dosyalar' | 'musteriler' | 'tedarikciler' | 'eksperler' | 'faturalar';
}

export interface SearchResults {
  dosyalar: SearchResultItem[];
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
    if (q.length < 2) {
      return { dosyalar: [], musteriler: [], tedarikciler: [], eksperler: [], faturalar: [], total: 0 };
    }

    const isFieldStaff = ['field_staff', 'FIELD_STAFF'].includes(roleCode);

    const [claimFiles, customers, vendors, adjusters, invoices] = await Promise.all([
      // Hasar Dosyaları
      this.prisma.claimFile.findMany({
        where: {
          AND: [
            isFieldStaff ? { assignedFieldUserId: userId } : {},
            {
              OR: [
                { fileNo: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { customer: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
                { customer: { is: { phone: { contains: q, mode: 'insensitive' } } } },
              ],
            },
          ],
        },
        select: {
          id: true,
          fileNo: true,
          description: true,
          customer: { select: { fullName: true } },
          currentStatus: { select: { name: true } },
        },
        take: LIMIT,
        orderBy: { updatedAt: 'desc' },
      }),

      // Müşteriler
      isFieldStaff
        ? Promise.resolve([])
        : this.prisma.customer.findMany({
            where: {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { taxNumber: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, fullName: true, phone: true, email: true },
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

    const dosyalarMapped: SearchResultItem[] = (claimFiles as any[]).map((f) => ({
      id: f.id,
      title: f.fileNo,
      subtitle: [f.customer?.fullName, f.currentStatus?.name].filter(Boolean).join(' · '),
      url: `/panel/hasar-dosyalari/${f.id}`,
      category: 'dosyalar' as const,
    }));

    const musterilerMapped: SearchResultItem[] = (customers as any[]).map((c) => ({
      id: c.id,
      title: c.fullName ?? '—',
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
      musterilerMapped.length +
      tedarikcilerMapped.length +
      eksperlerMapped.length +
      faturalarMapped.length;

    return {
      dosyalar: dosyalarMapped,
      musteriler: musterilerMapped,
      tedarikciler: tedarikcilerMapped,
      eksperler: eksperlerMapped,
      faturalar: faturalarMapped,
      total,
    };
  }
}
