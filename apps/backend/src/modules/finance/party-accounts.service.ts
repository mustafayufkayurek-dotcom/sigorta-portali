import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';
import {
  CARI_TUR_LABEL,
  FINANS_DONEM_KAPALI_MESAJ,
  FINANS_HEDEF_CIRO_AYAR_KEY,
  FINANS_KURULUM_AYAR_KEY,
  FINANS_MALI_DONEM_KAPANIS_AYAR_KEY,
  buildFinansDonemKapanisSatir,
  canConfirmFinansDonemKapanis,
  canShowFinansSeyir,
  cariBakiyeEtiket,
  cariNetBakiye,
  cariVarsayilanAcilisYon,
  finansDonemKapanisGun,
  finansDonemYili,
  finansKurulumEksikleri,
  finansMaliDonemAnahtar,
  finansMaliDonemEtiket,
  finansOncekiMaliYil,
  isCariAcilisYon,
  isCariTur,
  isFinansDonemKapaliForDate,
  canAcceptFinansHedefCiro,
  finansDonemYilListesi,
  maliDonemPromptFromLastPosting,
  normalizeFinansHedefCiro,
  normalizeFinansIsletmeSabitKalemi,
  normalizeFinansKurulum,
  normalizeFinansMaliDonemKapanis,
  proposeFinansHedefCiro,
  resolveFinansHedefSabitGider,
  shouldSuggestMaliYilKapanis,
  sumFinansIsletmeSabit,
  type CariAcilisYon,
  type CariTur,
  type FinansIsletmeSabitKalemi,
  type FinansKurulumDurum,
} from '@sigorta/shared';
import {
  CreatePartyAccountDto,
  CreatePartyAccountEntryDto,
  PatchFinansHedefCiroDto,
  PatchFinansKurulumDto,
  UpdatePartyAccountDto,
} from './dto/party-account.dto';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dec(n: number | Prisma.Decimal | null | undefined): number {
  if (n == null) return 0;
  return round2(typeof n === 'number' ? n : Number(n));
}

/** İstanbul takvim günü YYYY-MM-DD */
function istanbulTodayIso(): string {
  return istanbulDateIso(new Date());
}

function istanbulDateIso(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

@Injectable()
export class PartyAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SystemSettingsService,
  ) {}

  async getKurulum(): Promise<{
    kurulum: FinansKurulumDurum;
    seyirAcik: boolean;
    eksikler: string[];
    hesapSayisi: number;
  }> {
    const raw = await this.settings.get(FINANS_KURULUM_AYAR_KEY);
    const kurulum = normalizeFinansKurulum(raw);
    const hesapSayisi = await this.prisma.partyAccount.count({
      where: { isActive: true },
    });
    return {
      kurulum,
      seyirAcik: canShowFinansSeyir(kurulum),
      eksikler: finansKurulumEksikleri(kurulum),
      hesapSayisi,
    };
  }

  async patchKurulum(dto: PatchFinansKurulumDto): Promise<{
    kurulum: FinansKurulumDurum;
    seyirAcik: boolean;
    eksikler: string[];
  }> {
    const raw = await this.settings.get(FINANS_KURULUM_AYAR_KEY);
    const current = normalizeFinansKurulum(raw);
    const next: FinansKurulumDurum = { ...current };

    if (dto.cariTanim === true || dto.cariTanim === 'yok' || dto.cariTanim === false) {
      next.cariTanim = dto.cariTanim;
    }
    if (typeof dto.acilisGozdenGecirildi === 'boolean') {
      next.acilisGozdenGecirildi = dto.acilisGozdenGecirildi;
    }
    if (typeof dto.masrafKaynak === 'boolean') {
      next.masrafKaynak = dto.masrafKaynak;
    }
    if (typeof dto.seyirAcik === 'boolean') {
      next.seyirAcik = dto.seyirAcik;
    }

    await this.settings.set(FINANS_KURULUM_AYAR_KEY, next);
    return {
      kurulum: next,
      seyirAcik: canShowFinansSeyir(next),
      eksikler: finansKurulumEksikleri(next),
    };
  }

  private async markCariTanimli() {
    const raw = await this.settings.get(FINANS_KURULUM_AYAR_KEY);
    const current = normalizeFinansKurulum(raw);
    if (current.cariTanim === true) return;
    await this.settings.set(FINANS_KURULUM_AYAR_KEY, {
      ...current,
      cariTanim: true,
    });
  }

  private async balanceForAccount(accountId: string, asOfDate?: string) {
    const where: Prisma.PartyAccountEntryWhereInput = { accountId };
    if (asOfDate) {
      where.entryDate = { lte: new Date(asOfDate.slice(0, 10)) };
    }
    const agg = await this.prisma.partyAccountEntry.aggregate({
      where,
      _sum: { debitAmount: true, creditAmount: true },
    });
    const toplamBorc = dec(agg._sum.debitAmount);
    const toplamAlacak = dec(agg._sum.creditAmount);
    const net = cariNetBakiye({ toplamBorc, toplamAlacak });
    return { toplamBorc, toplamAlacak, net, etiket: cariBakiyeEtiket(net) };
  }

  /** Şirket Seyri — cari gerçek bakiyeler + hedef ciro önerisi (kurulum kapısından sonra). */
  async getSeyirOzet() {
    const setup = await this.getKurulum();
    const hedefKayit = normalizeFinansHedefCiro(
      await this.settings.get(FINANS_HEDEF_CIRO_AYAR_KEY),
    );
    if (!setup.seyirAcik) {
      return {
        seyirAcik: false as const,
        eksikler: setup.eksikler,
        cariAlacak: 0,
        cariBorc: 0,
        hesapSayisi: setup.hesapSayisi,
        hedefCiro: null,
        hedefKabul: hedefKayit.kabulAylik,
      };
    }
    const accounts = await this.findAll({ activeOnly: true });
    let cariAlacak = 0;
    let cariBorc = 0;
    for (const row of accounts) {
      const net = Number(row.netBakiye) || 0;
      if (net > 0.005) cariAlacak = round2(cariAlacak + net);
      else if (net < -0.005) cariBorc = round2(cariBorc + Math.abs(net));
    }

    const isletmeSabitToplam = sumFinansIsletmeSabit(hedefKayit.isletmeSabitKalemleri);
    const aylikSabitGider = resolveFinansHedefSabitGider(isletmeSabitToplam);
    const hedefCiro = proposeFinansHedefCiro({
      cariBorc,
      aylikSabitGider,
      borcAySayisi: hedefKayit.borcAySayisi,
      karPayiPct: hedefKayit.karPayiPct,
    });

    return {
      seyirAcik: true as const,
      eksikler: [] as string[],
      cariAlacak,
      cariBorc,
      hesapSayisi: accounts.length,
      hedefCiro: hedefCiro.oneriVar
        ? {
            ...hedefCiro,
            cariBorc,
          }
        : null,
      hedefOneriYokNeden: hedefCiro.oneriVar
        ? null
        : 'Cari borç veya aylık işletme sabiti yok; hedef üretilemez.',
      hedefKabul: hedefKayit.kabulAylik,
      hedefKabulAt: hedefKayit.kabulAylik ? hedefKayit.kabulAt : null,
      hedefParametre: {
        borcAySayisi: hedefKayit.borcAySayisi,
        karPayiPct: hedefKayit.karPayiPct,
        isletmeSabitKalemleri: hedefKayit.isletmeSabitKalemleri,
        isletmeSabitToplam,
        aylikSabitGider,
      },
    };
  }

  /** Gerçek finans hareketi olan yıllar — boş geçmiş uydurulmaz. */
  private async findYearsWithFinanceActivity(): Promise<number[]> {
    const years = new Set<number>();
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ y: number }[]>(`
        SELECT DISTINCT y FROM (
          SELECT EXTRACT(YEAR FROM entry_date)::int AS y FROM party_account_entries
          UNION
          SELECT EXTRACT(YEAR FROM date)::int FROM expenses
          UNION
          SELECT EXTRACT(YEAR FROM payment_date)::int FROM payments
          UNION
          SELECT EXTRACT(YEAR FROM entry_date)::int FROM claim_file_revenues
        ) q
        WHERE y IS NOT NULL AND y >= 2000 AND y <= 2100
      `);
      for (const row of rows) {
        const y = Math.trunc(Number(row.y));
        if (y >= 2000 && y <= 2100) years.add(y);
      }
    } catch {
      const last = await this.findLastPostingDateIso();
      if (last) years.add(Number(last.slice(0, 4)));
    }
    return [...years];
  }

  /** Son gider / gelir / tahsilat / cari hareket tarihi (İstanbul günü). */
  private async findLastPostingDateIso(): Promise<string | null> {
    const [expense, payment, revenue, entry] = await Promise.all([
      this.prisma.expense.findFirst({
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      this.prisma.payment.findFirst({
        orderBy: { paymentDate: 'desc' },
        select: { paymentDate: true },
      }),
      this.prisma.claimFileRevenue.findFirst({
        orderBy: { entryDate: 'desc' },
        select: { entryDate: true },
      }),
      this.prisma.partyAccountEntry.findFirst({
        orderBy: { entryDate: 'desc' },
        select: { entryDate: true },
      }),
    ]);
    const candidates: string[] = [];
    if (expense?.date) candidates.push(istanbulDateIso(expense.date));
    if (payment?.paymentDate) candidates.push(istanbulDateIso(payment.paymentDate));
    if (revenue?.entryDate) candidates.push(istanbulDateIso(revenue.entryDate));
    if (entry?.entryDate) candidates.push(istanbulDateIso(entry.entryDate));
    if (!candidates.length) return null;
    candidates.sort();
    return candidates[candidates.length - 1] ?? null;
  }

  /** Personel hedef ciroyu kabul eder veya elle yazar. Öneri sessizce kayda geçmez. */
  async patchHedefCiro(dto: PatchFinansHedefCiroDto) {
    const setup = await this.getKurulum();
    if (!setup.seyirAcik) {
      throw new BadRequestException(
        'Hedef ciro, cari kurulum bitmeden kabul edilmez.',
      );
    }
    const current = normalizeFinansHedefCiro(
      await this.settings.get(FINANS_HEDEF_CIRO_AYAR_KEY),
    );
    const next = { ...current };

    if (typeof dto.borcAySayisi === 'number') {
      next.borcAySayisi = Math.max(1, Math.min(36, Math.trunc(dto.borcAySayisi)));
    }
    if (typeof dto.karPayiPct === 'number') {
      next.karPayiPct = Math.max(0, Math.min(50, Number(dto.karPayiPct)));
    }
    if (Array.isArray(dto.isletmeSabitKalemleri)) {
      const kalemler: FinansIsletmeSabitKalemi[] = [];
      for (const row of dto.isletmeSabitKalemleri) {
        const k = normalizeFinansIsletmeSabitKalemi(row);
        if (k) kalemler.push(k);
      }
      next.isletmeSabitKalemleri = kalemler;
    }

    if (dto.kabul === true || typeof dto.kabulAylik === 'number') {
      let tutar: number | null =
        typeof dto.kabulAylik === 'number' && Number.isFinite(dto.kabulAylik)
          ? round2(Math.max(0, dto.kabulAylik))
          : null;
      if (tutar == null && dto.kabul === true) {
        const ozet = await this.getSeyirOzet();
        const cariBorc = Number(ozet.cariBorc) || 0;
        const aylikSabitGider = resolveFinansHedefSabitGider(
          sumFinansIsletmeSabit(next.isletmeSabitKalemleri),
        );
        const oneri = proposeFinansHedefCiro({
          cariBorc,
          aylikSabitGider,
          borcAySayisi: next.borcAySayisi,
          karPayiPct: next.karPayiPct,
        });
        tutar = oneri.oneriVar ? oneri.onerilenAylik : null;
      }
      if (!canAcceptFinansHedefCiro(tutar)) {
        throw new BadRequestException(
          'Hedef sıfır olamaz. Önce cari borç veya aylık işletme sabitini girin.',
        );
      }
      next.kabulAylik = tutar as number;
      next.kabulAt = new Date().toISOString();
    }

    await this.settings.set(FINANS_HEDEF_CIRO_AYAR_KEY, next);
    return this.getSeyirOzet();
  }

  async listClosedYears(): Promise<number[]> {
    const rows = await this.prisma.finansDonemKapanis.findMany({
      select: { year: true },
      orderBy: { year: 'desc' },
    });
    return rows.map((r) => r.year);
  }

  private async listClosedMaliDonemler(): Promise<string[]> {
    const raw = await this.settings.get(FINANS_MALI_DONEM_KAPANIS_AYAR_KEY);
    return normalizeFinansMaliDonemKapanis(raw).closed;
  }

  private async assertEntryDateOpen(entryDateIso: string) {
    const closedYears = await this.listClosedYears();
    const closedMonths = await this.listClosedMaliDonemler();
    if (isFinansDonemKapaliForDate(entryDateIso, closedYears, closedMonths)) {
      throw new BadRequestException(FINANS_DONEM_KAPALI_MESAJ);
    }
  }

  /** Önizleme veya kayıtlı kapanış — yeni dönem açılmaz. */
  async previewDonemKapanis(year: number) {
    const y = Math.trunc(Number(year));
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      throw new BadRequestException('Dönem yılı geçersiz');
    }
    const asOfDate = finansDonemKapanisGun(y);
    const today = istanbulTodayIso();
    const existing = await this.prisma.finansDonemKapanis.findUnique({
      where: { year: y },
      include: {
        closedBy: { select: { firstName: true, lastName: true } },
        lines: { orderBy: { accountName: 'asc' } },
      },
    });
    if (existing) {
      const lines = existing.lines.map((line) => {
        const satir = buildFinansDonemKapanisSatir({
          accountId: line.accountId,
          accountName: line.accountName,
          accountKind: line.accountKind,
          toplamBorc: dec(line.toplamBorc),
          toplamAlacak: dec(line.toplamAlacak),
        });
        return {
          ...satir,
          kindLabel: CARI_TUR_LABEL[satir.accountKind as CariTur] ?? satir.accountKind,
        };
      });
      return {
        year: y,
        asOfDate,
        closed: true as const,
        canConfirm: false,
        closedAt: existing.closedAt,
        closedByName:
          [existing.closedBy.firstName, existing.closedBy.lastName].filter(Boolean).join(' ') ||
          '—',
        note: existing.note,
        lines,
        totals: {
          toplamBorc: round2(lines.reduce((s, l) => s + l.toplamBorc, 0)),
          toplamAlacak: round2(lines.reduce((s, l) => s + l.toplamAlacak, 0)),
          netBakiye: round2(lines.reduce((s, l) => s + l.netBakiye, 0)),
        },
      };
    }

    const accounts = await this.prisma.partyAccount.findMany({
      orderBy: { name: 'asc' },
    });
    const lines = [];
    for (const acc of accounts) {
      const bal = await this.balanceForAccount(acc.id, asOfDate);
      if (bal.toplamBorc === 0 && bal.toplamAlacak === 0) continue;
      const satir = buildFinansDonemKapanisSatir({
        accountId: acc.id,
        accountName: acc.name,
        accountKind: acc.kind,
        toplamBorc: bal.toplamBorc,
        toplamAlacak: bal.toplamAlacak,
      });
      lines.push({
        ...satir,
        kindLabel: CARI_TUR_LABEL[satir.accountKind as CariTur] ?? satir.accountKind,
      });
    }
    return {
      year: y,
      asOfDate,
      closed: false as const,
      canConfirm: canConfirmFinansDonemKapanis(y, today),
      closedAt: null,
      closedByName: null,
      note: null,
      lines,
      totals: {
        toplamBorc: round2(lines.reduce((s, l) => s + l.toplamBorc, 0)),
        toplamAlacak: round2(lines.reduce((s, l) => s + l.toplamAlacak, 0)),
        netBakiye: round2(lines.reduce((s, l) => s + l.netBakiye, 0)),
      },
    };
  }

  async confirmDonemKapanis(year: number, userId: string, note?: string) {
    const preview = await this.previewDonemKapanis(year);
    if (preview.closed) {
      throw new BadRequestException(`${year} dönemi zaten kapatılmış`);
    }
    if (!preview.canConfirm) {
      throw new BadRequestException(
        `${year} dönemi henüz bitmedi. Kapanış 31.12.${year} sonrası yapılır.`,
      );
    }
    const asOf = new Date(preview.asOfDate);
    const created = await this.prisma.finansDonemKapanis.create({
      data: {
        year: preview.year,
        asOfDate: asOf,
        note: note?.trim() || null,
        closedByUserId: userId,
        lines: {
          create: preview.lines.map((line) => ({
            accountId: line.accountId,
            accountName: line.accountName,
            accountKind: line.accountKind,
            toplamBorc: line.toplamBorc,
            toplamAlacak: line.toplamAlacak,
            netBakiye: line.netBakiye,
          })),
        },
      },
    });
    return this.previewDonemKapanis(created.year);
  }

  async listDonemKapanisOzet() {
    const today = istanbulTodayIso();
    const currentYear = finansDonemYili(today);
    const closed = await this.prisma.finansDonemKapanis.findMany({
      orderBy: { year: 'desc' },
      select: {
        year: true,
        asOfDate: true,
        closedAt: true,
        closedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { lines: true } },
      },
    });
    const closedYears = closed.map((c) => c.year);
    const closedMonths = await this.listClosedMaliDonemler();
    const lastPostingDate = await this.findLastPostingDateIso();
    const activityYears = await this.findYearsWithFinanceActivity();
    const maliDonemPrompt = maliDonemPromptFromLastPosting(
      today,
      lastPostingDate,
      closedMonths,
    );
    const maliYil = finansOncekiMaliYil(today);
    const includeClosablePrevious = Boolean(
      maliYil && canConfirmFinansDonemKapanis(maliYil.year, today),
    );
    const years = finansDonemYilListesi({
      currentYear,
      activityYears,
      closedYears,
      includeClosablePrevious,
    });
    const uyariMaliDonem = maliDonemPrompt
      ? {
          kind: 'mali_donem' as const,
          year: maliDonemPrompt.year,
          month: maliDonemPrompt.month,
          periodKey: maliDonemPrompt.periodKey,
          label: maliDonemPrompt.label,
          asOfDate: maliDonemPrompt.asOfDate,
          lastPostingDate: maliDonemPrompt.lastPostingDate,
          promptOnDate: maliDonemPrompt.promptOnDate,
        }
      : null;
    const uyariMaliYil =
      maliYil && shouldSuggestMaliYilKapanis(maliYil.year, today, closedYears)
        ? {
            kind: 'mali_yil' as const,
            year: maliYil.year,
            label: maliYil.label,
            asOfDate: maliYil.asOfDate,
          }
        : null;

    const invoiceOpenStatuses = ['pending', 'approved', 'invoiced'] as const;
    const [
      hasarOpenCount,
      acilOpenCount,
      hasarClosedWithoutInvoiceCount,
      acilClosedWithoutInvoiceCount,
      pendingInvoiceRequestCount,
    ] = await Promise.all([
      this.prisma.claimFile.count({
        where: { currentStatus: { isClosedState: false } },
      }),
      this.prisma.emergencyCase.count({
        where: { status: { in: ['GELEN', 'ATANDI', 'SAHADA'] } },
      }),
      this.prisma.claimFile.count({
        where: {
          currentStatus: { isClosedState: true },
          invoiceRequests: {
            none: { status: { in: [...invoiceOpenStatuses] } },
          },
        },
      }),
      this.prisma.emergencyCase.count({
        where: {
          status: 'COZULDU',
          invoiceRequests: {
            none: { status: { in: [...invoiceOpenStatuses] } },
          },
        },
      }),
      this.prisma.invoiceRequest.count({
        where: { status: 'pending' },
      }),
    ]);
    const openFileCount = hasarOpenCount + acilOpenCount;
    const closedWithoutInvoiceCount =
      hasarClosedWithoutInvoiceCount + acilClosedWithoutInvoiceCount;
    const suggestedYear = uyariMaliYil?.year ?? maliYil?.year ?? null;
    const blockers = {
      openFiles: openFileCount > 0,
      missingInvoiceRequests: closedWithoutInvoiceCount > 0,
    };
    const canCloseYear = !blockers.openFiles && !blockers.missingInvoiceRequests;

    return {
      today,
      currentYear,
      lastPostingDate,
      suggestedYear,
      uyariMaliDonem,
      uyariMaliYil,
      disiplin: {
        openFileCount,
        closedWithoutInvoiceCount,
        hasarOpenCount,
        acilOpenCount,
        pendingInvoiceRequestCount,
        canCloseYear,
        blockers,
        openFilesHref: '/panel/hasar-dosyalari?status=open',
        openAcilHref: '/panel/operasyon?filter=acil',
        invoiceRequestsHref: '/panel/finans/fatura-talepleri',
        carilerHref: '/panel/finans/cariler',
        masraflarHref: '/panel/finans/masraflar',
      },
      years: years.map((year) => {
        const row = closed.find((c) => c.year === year);
        const canConfirmDate = !row && canConfirmFinansDonemKapanis(year, today);
        return {
          year,
          closed: Boolean(row),
          canConfirm: canConfirmDate,
          isSuggested: suggestedYear === year && canConfirmDate,
          asOfDate: finansDonemKapanisGun(year),
          closedAt: row?.closedAt ?? null,
          closedByName: row
            ? [row.closedBy.firstName, row.closedBy.lastName].filter(Boolean).join(' ') || '—'
            : null,
          lineCount: row?._count.lines ?? null,
        };
      }),
    };
  }

  /** Mali dönem (ay) kapanışı — ay anahtarı kilitlenir; yeni dönem açılmaz. */
  async confirmMaliDonem(year: number, month: number) {
    const y = Math.trunc(Number(year));
    const m = Math.trunc(Number(month));
    if (!Number.isFinite(y) || y < 2000 || y > 2100 || m < 1 || m > 12) {
      throw new BadRequestException('Mali dönem geçersiz');
    }
    const today = istanbulTodayIso();
    const lastPostingDate = await this.findLastPostingDateIso();
    const closedMonths = await this.listClosedMaliDonemler();
    const prompt = maliDonemPromptFromLastPosting(today, lastPostingDate, closedMonths);
    const periodKey = finansMaliDonemAnahtar(y, m);
    if (!prompt || prompt.periodKey !== periodKey) {
      throw new BadRequestException(
        'Bu mali dönem henüz kapatma zamanında değil veya zaten kapalı.',
      );
    }
    const current = normalizeFinansMaliDonemKapanis(
      await this.settings.get(FINANS_MALI_DONEM_KAPANIS_AYAR_KEY),
    );
    if (current.closed.includes(periodKey)) {
      return {
        periodKey,
        label: finansMaliDonemEtiket(y, m),
        alreadyClosed: true as const,
      };
    }
    await this.settings.set(FINANS_MALI_DONEM_KAPANIS_AYAR_KEY, {
      closed: [...current.closed, periodKey],
    });
    return {
      periodKey,
      label: finansMaliDonemEtiket(y, m),
      alreadyClosed: false as const,
    };
  }

  private mapAccount(
    row: {
      id: string;
      code: string | null;
      name: string;
      kind: string;
      cardLast4: string | null;
      cardLabel: string | null;
      contactPhone: string | null;
      contactEmail: string | null;
      linkedCustomerId: string | null;
      linkedVendorId: string | null;
      notes: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      customer?: {
        id: string;
        shortName: string | null;
        companyName: string | null;
        fullName: string | null;
        phone: string | null;
        email: string | null;
      } | null;
      vendor?: {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
        authorizedPhone: string | null;
        authorizedEmail: string | null;
      } | null;
    },
    balance: Awaited<ReturnType<PartyAccountsService['balanceForAccount']>>,
  ) {
    const kind = isCariTur(row.kind) ? row.kind : 'diger';
    const contactPhone =
      row.contactPhone ||
      row.customer?.phone ||
      row.vendor?.authorizedPhone ||
      row.vendor?.phone ||
      null;
    const contactEmail =
      row.contactEmail ||
      row.customer?.email ||
      row.vendor?.authorizedEmail ||
      row.vendor?.email ||
      null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      kind,
      kindLabel: CARI_TUR_LABEL[kind],
      cardLast4: row.cardLast4,
      cardLabel: row.cardLabel,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      resolvedPhone: contactPhone,
      resolvedEmail: contactEmail,
      linkedCustomerId: row.linkedCustomerId,
      linkedVendorId: row.linkedVendorId,
      linkedCustomerName:
        row.customer?.shortName ||
        row.customer?.companyName ||
        row.customer?.fullName ||
        null,
      linkedVendorName: row.vendor?.name ?? null,
      notes: row.notes,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      toplamBorc: balance.toplamBorc,
      toplamAlacak: balance.toplamAlacak,
      netBakiye: balance.net,
      bakiyeYon: balance.etiket.yon,
      bakiyeTutar: balance.etiket.tutar,
      bakiyeLabel: balance.etiket.label,
    };
  }

  private accountInclude = {
    customer: {
      select: {
        id: true,
        shortName: true,
        companyName: true,
        fullName: true,
        phone: true,
        email: true,
      },
    },
    vendor: {
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        authorizedPhone: true,
        authorizedEmail: true,
      },
    },
  } as const;

  async findAll(query?: { kind?: string; q?: string; activeOnly?: boolean }) {
    const where: Prisma.PartyAccountWhereInput = {};
    if (query?.activeOnly !== false) where.isActive = true;
    if (query?.kind && isCariTur(query.kind)) where.kind = query.kind;
    if (query?.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { cardLabel: { contains: q, mode: 'insensitive' } },
        { cardLast4: { contains: q } },
      ];
    }

    const rows = await this.prisma.partyAccount.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      include: this.accountInclude,
    });

    const out = [];
    for (const row of rows) {
      const balance = await this.balanceForAccount(row.id);
      out.push(this.mapAccount(row, balance));
    }
    return out;
  }

  async findOne(id: string) {
    const row = await this.prisma.partyAccount.findUnique({
      where: { id },
      include: this.accountInclude,
    });
    if (!row) throw new NotFoundException('Cari hesap bulunamadı');
    const balance = await this.balanceForAccount(row.id);
    return this.mapAccount(row, balance);
  }

  async getStatement(id: string) {
    const account = await this.findOne(id);
    const entries = await this.prisma.partyAccountEntry.findMany({
      where: { accountId: id },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let running = 0;
    const lines = entries.map((e) => {
      const debit = dec(e.debitAmount);
      const credit = dec(e.creditAmount);
      running = round2(running + debit - credit);
      return {
        id: e.id,
        entryDate: e.entryDate,
        description: e.description,
        debitAmount: debit,
        creditAmount: credit,
        sourceKind: e.sourceKind,
        sourceId: e.sourceId,
        runningBalance: running,
        createdAt: e.createdAt,
        createdByName: [e.createdBy.firstName, e.createdBy.lastName].filter(Boolean).join(' ') || '—',
      };
    });

    return { account, lines };
  }

  async create(dto: CreatePartyAccountDto, userId: string) {
    if (!isCariTur(dto.kind)) {
      throw new BadRequestException('Cari türü geçersiz');
    }
    const name = dto.name.trim();
    if (name.length < 2) throw new BadRequestException('Cari adı zorunludur');

    const kind = dto.kind as CariTur;
    const openingAmount = round2(Number(dto.openingAmount) || 0);
    let openingDirection: CariAcilisYon = cariVarsayilanAcilisYon(kind);
    if (dto.openingDirection && isCariAcilisYon(dto.openingDirection)) {
      openingDirection = dto.openingDirection;
    }

    if (dto.linkedCustomerId) {
      const c = await this.prisma.customer.findUnique({ where: { id: dto.linkedCustomerId } });
      if (!c) throw new BadRequestException('Bağlı müşteri bulunamadı');
    }
    if (dto.linkedVendorId) {
      const v = await this.prisma.vendor.findUnique({ where: { id: dto.linkedVendorId } });
      if (!v) throw new BadRequestException('Bağlı tedarikçi bulunamadı');
    }

    const openingDateIso =
      openingAmount > 0 ? dto.openingDate?.slice(0, 10) || istanbulTodayIso() : null;
    if (openingDateIso) await this.assertEntryDateOpen(openingDateIso);

    const account = await this.prisma.$transaction(async (tx) => {
      const created = await tx.partyAccount.create({
        data: {
          name,
          kind,
          code: dto.code?.trim() || null,
          cardLast4: dto.cardLast4?.replace(/\D/g, '').slice(-4) || null,
          cardLabel: dto.cardLabel?.trim() || null,
          contactPhone: dto.contactPhone?.trim() || null,
          contactEmail: dto.contactEmail?.trim().toLowerCase() || null,
          linkedCustomerId: dto.linkedCustomerId || null,
          linkedVendorId: dto.linkedVendorId || null,
          notes: dto.notes?.trim() || null,
          createdByUserId: userId,
        },
      });

      if (openingAmount > 0 && openingDateIso) {
        const debit = openingDirection === 'alacak' ? openingAmount : 0;
        const credit = openingDirection === 'borc' ? openingAmount : 0;
        await tx.partyAccountEntry.create({
          data: {
            accountId: created.id,
            entryDate: new Date(openingDateIso),
            description: 'Açılış Bakiyesi',
            debitAmount: debit,
            creditAmount: credit,
            sourceKind: 'acilis',
            createdByUserId: userId,
          },
        });
      }

      return created;
    });

    await this.markCariTanimli();
    return this.findOne(account.id);
  }

  async update(id: string, dto: UpdatePartyAccountDto) {
    await this.findOne(id);
    if (dto.kind != null && !isCariTur(dto.kind)) {
      throw new BadRequestException('Cari türü geçersiz');
    }
    if (dto.name != null && dto.name.trim().length < 2) {
      throw new BadRequestException('Cari adı zorunludur');
    }

    await this.prisma.partyAccount.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.kind != null ? { kind: dto.kind } : {}),
        ...(dto.code !== undefined ? { code: dto.code?.trim() || null } : {}),
        ...(dto.cardLast4 !== undefined
          ? { cardLast4: dto.cardLast4?.replace(/\D/g, '').slice(-4) || null }
          : {}),
        ...(dto.cardLabel !== undefined ? { cardLabel: dto.cardLabel?.trim() || null } : {}),
        ...(dto.contactPhone !== undefined
          ? { contactPhone: dto.contactPhone?.trim() || null }
          : {}),
        ...(dto.contactEmail !== undefined
          ? { contactEmail: dto.contactEmail?.trim().toLowerCase() || null }
          : {}),
        ...(dto.linkedCustomerId !== undefined
          ? { linkedCustomerId: dto.linkedCustomerId || null }
          : {}),
        ...(dto.linkedVendorId !== undefined
          ? { linkedVendorId: dto.linkedVendorId || null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(typeof dto.isActive === 'boolean' ? { isActive: dto.isActive } : {}),
      },
    });

    return this.findOne(id);
  }

  async addManualEntry(accountId: string, dto: CreatePartyAccountEntryDto, userId: string) {
    await this.findOne(accountId);
    const debit = round2(Number(dto.debitAmount) || 0);
    const credit = round2(Number(dto.creditAmount) || 0);
    if (debit <= 0 && credit <= 0) {
      throw new BadRequestException('Borç veya alacak tutarı girin');
    }
    if (debit > 0 && credit > 0) {
      throw new BadRequestException('Aynı satırda hem borç hem alacak olmaz');
    }
    const description = dto.description.trim();
    if (description.length < 2) {
      throw new BadRequestException('Açıklama zorunludur');
    }
    const entryDate = dto.entryDate.slice(0, 10);
    await this.assertEntryDateOpen(entryDate);

    await this.prisma.partyAccountEntry.create({
      data: {
        accountId,
        entryDate: new Date(entryDate),
        description,
        debitAmount: debit,
        creditAmount: credit,
        sourceKind: 'manuel',
        createdByUserId: userId,
      },
    });

    return this.getStatement(accountId);
  }

  /** Masraf kaydı cariye borç yazar (biz ödedik / kart borcu arttı). */
  async postExpenseDebit(input: {
    accountId: string;
    expenseId: string;
    amount: number;
    entryDate: Date | string;
    description: string;
    userId: string;
  }) {
    const amount = round2(input.amount);
    if (amount <= 0) return null;
    await this.findOne(input.accountId);
    const entryDate =
      typeof input.entryDate === 'string'
        ? input.entryDate.slice(0, 10)
        : input.entryDate.toISOString().slice(0, 10);
    await this.assertEntryDateOpen(entryDate);
    return this.prisma.partyAccountEntry.create({
      data: {
        accountId: input.accountId,
        entryDate: new Date(entryDate),
        description: input.description.slice(0, 240) || 'Masraf',
        debitAmount: 0,
        creditAmount: amount,
        sourceKind: 'masraf',
        sourceId: input.expenseId,
        createdByUserId: input.userId,
      },
    });
  }

  /** Müşteri carisi yoksa açar (alacak tarafı). */
  async ensureCustomerAccount(input: {
    customerId: string;
    userId: string;
    name?: string | null;
  }): Promise<{ id: string }> {
    const existing = await this.prisma.partyAccount.findFirst({
      where: { linkedCustomerId: input.customerId, isActive: true },
      select: { id: true },
    });
    if (existing) return existing;

    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        shortName: true,
        companyName: true,
        fullName: true,
      },
    });
    if (!customer) throw new BadRequestException('Müşteri bulunamadı');
    const name =
      (input.name || '').trim() ||
      customer.shortName ||
      customer.companyName ||
      customer.fullName ||
      'Müşteri Carisi';
    const created = await this.prisma.partyAccount.create({
      data: {
        name: name.slice(0, 160),
        kind: 'musteri',
        linkedCustomerId: customer.id,
        createdByUserId: input.userId,
      },
    });
    await this.markCariTanimli();
    return { id: created.id };
  }

  /** Tedarikçi carisi yoksa açar (borç tarafı). */
  async ensureVendorAccount(input: {
    vendorId: string;
    userId: string;
    name?: string | null;
  }): Promise<{ id: string }> {
    const existing = await this.prisma.partyAccount.findFirst({
      where: { linkedVendorId: input.vendorId, isActive: true },
      select: { id: true },
    });
    if (existing) return existing;

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: input.vendorId },
      select: { id: true, name: true },
    });
    if (!vendor) throw new BadRequestException('Tedarikçi bulunamadı');
    const name = (input.name || '').trim() || vendor.name || 'Tedarikçi Carisi';
    const created = await this.prisma.partyAccount.create({
      data: {
        name: name.slice(0, 160),
        kind: 'tedarikci',
        linkedVendorId: vendor.id,
        createdByUserId: input.userId,
      },
    });
    await this.markCariTanimli();
    return { id: created.id };
  }

  private async entryDateIso(entryDate: Date | string): Promise<string> {
    const iso =
      typeof entryDate === 'string'
        ? entryDate.slice(0, 10)
        : entryDate.toISOString().slice(0, 10);
    await this.assertEntryDateOpen(iso);
    return iso;
  }

  private async findExistingSourceEntry(sourceKind: string, sourceId: string) {
    return this.prisma.partyAccountEntry.findFirst({
      where: { sourceKind, sourceId },
      select: { id: true, accountId: true },
    });
  }

  /** Dosya geliri → müşteri carisinde Borç (alacağımız artar). */
  async postGelirBorc(input: {
    customerId: string;
    revenueId: string;
    amount: number;
    entryDate: Date | string;
    description: string;
    userId: string;
    customerName?: string | null;
  }) {
    const amount = round2(input.amount);
    if (amount <= 0) return null;
    const existing = await this.findExistingSourceEntry('gelir', input.revenueId);
    if (existing) return existing;
    const account = await this.ensureCustomerAccount({
      customerId: input.customerId,
      userId: input.userId,
      name: input.customerName,
    });
    const entryDate = await this.entryDateIso(input.entryDate);
    return this.prisma.partyAccountEntry.create({
      data: {
        accountId: account.id,
        entryDate: new Date(entryDate),
        description: input.description.slice(0, 240) || 'Gelir',
        debitAmount: amount,
        creditAmount: 0,
        sourceKind: 'gelir',
        sourceId: input.revenueId,
        createdByUserId: input.userId,
      },
    });
  }

  /** Tahsilat → müşteri carisinde Alacak (alacağımız azalır). */
  async postTahsilatAlacak(input: {
    customerId: string;
    paymentId: string;
    amount: number;
    entryDate: Date | string;
    description: string;
    userId: string;
    customerName?: string | null;
  }) {
    const amount = round2(input.amount);
    if (amount <= 0) return null;
    const existing = await this.findExistingSourceEntry('tahsilat', input.paymentId);
    if (existing) return existing;
    const account = await this.ensureCustomerAccount({
      customerId: input.customerId,
      userId: input.userId,
      name: input.customerName,
    });
    const entryDate = await this.entryDateIso(input.entryDate);
    return this.prisma.partyAccountEntry.create({
      data: {
        accountId: account.id,
        entryDate: new Date(entryDate),
        description: input.description.slice(0, 240) || 'Tahsilat',
        debitAmount: 0,
        creditAmount: amount,
        sourceKind: 'tahsilat',
        sourceId: input.paymentId,
        createdByUserId: input.userId,
      },
    });
  }

  /** Tedarikçi ödemesi → tedarikçi carisinde Borç (borcumuz azalır). */
  async postOdemeBorc(input: {
    vendorId: string;
    paymentId: string;
    amount: number;
    entryDate: Date | string;
    description: string;
    userId: string;
    vendorName?: string | null;
  }) {
    const amount = round2(input.amount);
    if (amount <= 0) return null;
    const existing = await this.findExistingSourceEntry('odeme', input.paymentId);
    if (existing) return existing;
    const account = await this.ensureVendorAccount({
      vendorId: input.vendorId,
      userId: input.userId,
      name: input.vendorName,
    });
    const entryDate = await this.entryDateIso(input.entryDate);
    return this.prisma.partyAccountEntry.create({
      data: {
        accountId: account.id,
        entryDate: new Date(entryDate),
        description: input.description.slice(0, 240) || 'Ödeme',
        debitAmount: amount,
        creditAmount: 0,
        sourceKind: 'odeme',
        sourceId: input.paymentId,
        createdByUserId: input.userId,
      },
    });
  }

  /** Personel carisi yoksa açar (kod: personel-{userId}). */
  async ensurePersonelAccount(input: {
    personnelUserId: string;
    actorUserId: string;
    displayName?: string | null;
  }): Promise<{ id: string }> {
    const code = `personel-${input.personnelUserId}`;
    const existing = await this.prisma.partyAccount.findFirst({
      where: { code, isActive: true },
      select: { id: true },
    });
    if (existing) return existing;

    const name =
      (input.displayName || '').trim() ||
      (await this.prisma.user
        .findUnique({
          where: { id: input.personnelUserId },
          select: { firstName: true, lastName: true },
        })
        .then((u) =>
          u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '',
        )) ||
      'Personel Carisi';
    const created = await this.prisma.partyAccount.create({
      data: {
        code,
        name: `Personel — ${name}`.slice(0, 160),
        kind: 'diger',
        notes: `Personel cari (userId=${input.personnelUserId})`,
        createdByUserId: input.actorUserId,
      },
    });
    await this.markCariTanimli();
    return { id: created.id };
  }

  /**
   * Kabul edilen aylık net maaş → personel carisinde Alacak (borcumuz).
   * Aynı dönem ikinci kez yazılmaz (sourceId: maas:{profileId}:{yyyy-mm}).
   */
  async postPersonelMaasBorc(input: {
    personnelUserId: string;
    employeeProfileId: string;
    year: number;
    month: number;
    netAmount: number;
    entryDate: Date | string;
    description: string;
    actorUserId: string;
    displayName?: string | null;
  }) {
    const amount = round2(input.netAmount);
    if (amount <= 0) return null;
    const period = `${input.year}-${String(input.month).padStart(2, '0')}`;
    const sourceId = `maas:${input.employeeProfileId}:${period}`;
    const existing = await this.findExistingSourceEntry('maas', sourceId);
    if (existing) return existing;
    const account = await this.ensurePersonelAccount({
      personnelUserId: input.personnelUserId,
      actorUserId: input.actorUserId,
      displayName: input.displayName,
    });
    const entryDate = await this.entryDateIso(input.entryDate);
    return this.prisma.partyAccountEntry.create({
      data: {
        accountId: account.id,
        entryDate: new Date(entryDate),
        description: input.description.slice(0, 240) || `Maaş ${period}`,
        debitAmount: 0,
        creditAmount: amount,
        sourceKind: 'maas',
        sourceId,
        createdByUserId: input.actorUserId,
      },
    });
  }

  /** Ödeme kaydı için bağlı cari hesap id (liste / ekstre linki). */
  async resolvePartyAccountIdForPayment(input: {
    paymentType: string;
    payerType: string;
    payerId?: string | null;
    claimCustomerId?: string | null;
  }): Promise<string | null> {
    if (input.paymentType === 'outgoing' && input.payerType === 'vendor' && input.payerId) {
      const row = await this.prisma.partyAccount.findFirst({
        where: { linkedVendorId: input.payerId, isActive: true },
        select: { id: true },
      });
      return row?.id ?? null;
    }
    if (input.paymentType === 'incoming' && input.claimCustomerId) {
      const row = await this.prisma.partyAccount.findFirst({
        where: { linkedCustomerId: input.claimCustomerId, isActive: true },
        select: { id: true },
      });
      return row?.id ?? null;
    }
    return null;
  }
}
