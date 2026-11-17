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
  NAKIT_KASA_CARI_KODU,
  bankaCariKodu,
  buildFinansDonemKapanisSatir,
  buildFinansSeyirDonemKarZarar,
  canConfirmFinansDonemKapanis,
  canShowFinansSeyir,
  cariBakiyeEtiket,
  cariNetBakiye,
  cariCiftRolKimlikHatasi,
  cariTurFilterKinds,
  cariVarsayilanAcilisYon,
  isCariKarsiTarafRol,
  isCariKarsiTarafTur,
  normalizeCariKarsiTarafRol,
  type CariKarsiTarafRol,
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
  finansIsletmeSabitAktifAyda,
  finansIsletmeSabitEntryDateIso,
  finansIsletmeSabitSourceId,
  proposeFinansHedefCiro,
  resolveFinansHedefSabitGider,
  shouldSuggestMaliYilKapanis,
  splitFinansSeyirBakiyeleri,
  sumFinansIsletmeSabit,
  type CariAcilisYon,
  type CariTur,
  type FinansIsletmeSabitKalemi,
  type FinansIsletmeSabitDusumOzet,
  type FinansKurulumDurum,
} from '@sigorta/shared';
import {
  CreatePartyAccountDto,
  CreatePartyAccountEntryDto,
  PatchFinansHedefCiroDto,
  PatchFinansKurulumDto,
  UpdatePartyAccountDto,
} from './dto/party-account.dto';
import { vatReportPeriodBounds } from './vat-report-period';

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
  async getSeyirOzet(query?: { year?: number; month?: number }) {
    const setup = await this.getKurulum();
    const hedefKayit = normalizeFinansHedefCiro(
      await this.settings.get(FINANS_HEDEF_CIRO_AYAR_KEY),
    );
    const now = new Date();
    const year =
      typeof query?.year === 'number' && Number.isFinite(query.year) && query.year >= 2000
        ? Math.trunc(query.year)
        : now.getFullYear();
    const monthRaw =
      typeof query?.month === 'number' && Number.isFinite(query.month)
        ? Math.trunc(query.month)
        : now.getMonth() + 1;
    const month = monthRaw >= 1 && monthRaw <= 12 ? monthRaw : undefined;
    const emptyDonem = buildFinansSeyirDonemKarZarar({});
    if (!setup.seyirAcik) {
      return {
        seyirAcik: false as const,
        eksikler: setup.eksikler,
        cariAlacak: 0,
        cariBorc: 0,
        nakit: 0,
        hesapSayisi: setup.hesapSayisi,
        year,
        month: month ?? null,
        ...emptyDonem,
        hedefCiro: null,
        hedefKabul: hedefKayit.kabulAylik,
      };
    }
    const accounts = await this.findAll({ activeOnly: true });
    const { cariAlacak, cariBorc, nakit } = splitFinansSeyirBakiyeleri(accounts);
    const donem = await this.sumSeyirDonemKarZarar(year, month);

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
      nakit,
      hesapSayisi: accounts.length,
      year,
      month: month ?? null,
      ...donem,
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

  /** Dönem gelir/gider: Hasar geliri + Acil gelir/gider + Masraf İzleme. */
  private async sumSeyirDonemKarZarar(year: number, month?: number) {
    const { from, to } = vatReportPeriodBounds(year, month);
    const [hasarGelirAgg, acilGelirAgg, acilGiderAgg, masrafAgg] = await Promise.all([
      this.prisma.claimFileRevenue.aggregate({
        where: {
          entryDate: { gte: from, lte: to },
          status: { not: 'cancelled' },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.emergencyCostEntry.aggregate({
        where: {
          entryType: 'gelir',
          entryDate: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
      this.prisma.emergencyCostEntry.aggregate({
        where: {
          entryType: 'gider',
          entryDate: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          date: { gte: from, lte: to },
          approvalStatus: { not: 'REJECTED' },
        },
        _sum: { amount: true },
      }),
    ]);
    return buildFinansSeyirDonemKarZarar({
      hasarGelir: hasarGelirAgg._sum.totalAmount,
      acilGelir: acilGelirAgg._sum.amount,
      acilGider: acilGiderAgg._sum.amount,
      masrafGider: dec(masrafAgg._sum.amount),
    });
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
    if (query?.kind && isCariTur(query.kind)) {
      const kinds = cariTurFilterKinds(query.kind);
      where.kind = kinds.length === 1 ? kinds[0] : { in: kinds };
    }
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
    if (
      isCariKarsiTarafTur(kind) &&
      !dto.linkedCustomerId &&
      !dto.linkedVendorId
    ) {
      throw new BadRequestException(
        'Müşteri veya tedarikçi carisi Müşteriler / Tedarikçiler kartından açılır.',
      );
    }
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

  /**
   * Masraf → cari Alacak (biz ödedik / kart borcu arttı).
   * Aynı masraf için tek hareket; tutar / cari / tarih değişince güncellenir.
   */
  async syncExpenseDebit(input: {
    accountId: string;
    expenseId: string;
    amount: number;
    entryDate: Date | string;
    description: string;
    userId: string;
  }) {
    const amount = round2(input.amount);
    const existing = await this.prisma.partyAccountEntry.findFirst({
      where: { sourceKind: 'masraf', sourceId: input.expenseId },
      select: { id: true, entryDate: true },
    });
    if (amount <= 0) {
      if (existing) {
        await this.assertEntryDateOpen(istanbulDateIso(existing.entryDate));
        await this.prisma.partyAccountEntry.delete({ where: { id: existing.id } });
      }
      return null;
    }
    await this.findOne(input.accountId);
    const entryDate =
      typeof input.entryDate === 'string'
        ? input.entryDate.slice(0, 10)
        : istanbulDateIso(input.entryDate);
    await this.assertEntryDateOpen(entryDate);
    if (existing) {
      await this.assertEntryDateOpen(istanbulDateIso(existing.entryDate));
      return this.prisma.partyAccountEntry.update({
        where: { id: existing.id },
        data: {
          accountId: input.accountId,
          entryDate: new Date(entryDate),
          description: input.description.slice(0, 240) || 'Masraf',
          debitAmount: 0,
          creditAmount: amount,
        },
      });
    }
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

  /** Geriye uyum — syncExpenseDebit ile aynı. */
  async postExpenseDebit(input: {
    accountId: string;
    expenseId: string;
    amount: number;
    entryDate: Date | string;
    description: string;
    userId: string;
  }) {
    return this.syncExpenseDebit(input);
  }

  /** Masraf silinince cari hareketi kalkar. */
  async voidExpenseDebit(expenseId: string) {
    const existing = await this.prisma.partyAccountEntry.findFirst({
      where: { sourceKind: 'masraf', sourceId: expenseId },
      select: { id: true, entryDate: true },
    });
    if (!existing) return;
    await this.assertEntryDateOpen(istanbulDateIso(existing.entryDate));
    await this.prisma.partyAccountEntry.delete({ where: { id: existing.id } });
  }

  /**
   * Aynı müşteri/tedarikçiye bağlı birden fazla aktif cari varsa
   * en eskiyi tutar, hareketleri taşır, diğerlerini pasife alır.
   */
  private async coalesceLinkedPartyAccounts(link: {
    linkedCustomerId?: string;
    linkedVendorId?: string;
  }): Promise<{ id: string } | null> {
    const where =
      link.linkedCustomerId != null
        ? { linkedCustomerId: link.linkedCustomerId, isActive: true }
        : link.linkedVendorId != null
          ? { linkedVendorId: link.linkedVendorId, isActive: true }
          : null;
    if (!where) return null;
    const rows = await this.prisma.partyAccount.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return this.mergePartyAccountRows(rows);
  }

  /**
   * Çift rol: müşteri carisi + tedarikçi carisi ayrı açılmışsa tek hesapta birleştirir.
   */
  private async coalesceDualPartyAccounts(input: {
    customerId: string;
    vendorId: string;
  }): Promise<{ id: string } | null> {
    const rows = await this.prisma.partyAccount.findMany({
      where: {
        isActive: true,
        OR: [
          { linkedCustomerId: input.customerId },
          { linkedVendorId: input.vendorId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return this.mergePartyAccountRows(rows);
  }

  private async mergePartyAccountRows(
    rows: Array<{ id: string }>,
  ): Promise<{ id: string } | null> {
    if (rows.length === 0) return null;
    const primary = rows[0]!;
    const extras = rows.slice(1).map((r) => r.id);
    if (extras.length > 0) {
      await this.prisma.partyAccountEntry.updateMany({
        where: { accountId: { in: extras } },
        data: { accountId: primary.id },
      });
      await this.prisma.partyAccount.updateMany({
        where: { id: { in: extras } },
        data: { isActive: false },
      });
    }
    return primary;
  }

  /** Müşteri carisi yoksa açar (alacak tarafı). Çift rolde tedarikçi ikizi de bağlanır. */
  async ensureCustomerAccount(input: {
    customerId: string;
    userId: string;
    name?: string | null;
    cariRol?: unknown;
  }): Promise<{ id: string }> {
    const role = normalizeCariKarsiTarafRol(input.cariRol, 'musteri');
    if (role === 'tedarikci') {
      throw new BadRequestException('Müşteri kartında cari rol Tedarikçi olamaz');
    }
    return this.ensureKarsiTarafCari({
      role,
      customerId: input.customerId,
      userId: input.userId,
      name: input.name,
    });
  }

  /** Tedarikçi carisi yoksa açar (borç tarafı). Çift rolde müşteri ikizi de bağlanır. */
  async ensureVendorAccount(input: {
    vendorId: string;
    userId: string;
    name?: string | null;
    cariRol?: unknown;
  }): Promise<{ id: string }> {
    const role = normalizeCariKarsiTarafRol(input.cariRol, 'tedarikci');
    if (role === 'musteri') {
      throw new BadRequestException('Tedarikçi kartında cari rol Müşteri olamaz');
    }
    return this.ensureKarsiTarafCari({
      role,
      vendorId: input.vendorId,
      userId: input.userId,
      name: input.name,
    });
  }

  /**
   * Karşı taraf carisi — tek hesap.
   * Müşteri Ve Tedarikçi: müşteri + tedarikçi ikizi aynı caride (her iki listede görünür).
   */
  async ensureKarsiTarafCari(input: {
    role: CariKarsiTarafRol;
    customerId?: string;
    vendorId?: string;
    userId: string;
    name?: string | null;
  }): Promise<{ id: string }> {
    if (!isCariKarsiTarafRol(input.role)) {
      throw new BadRequestException('Cari rol geçersiz');
    }
    let customerId = input.customerId?.trim() || null;
    let vendorId = input.vendorId?.trim() || null;

    if (input.role === 'musteri_tedarikci') {
      if (customerId && !vendorId) {
        vendorId = await this.ensureVendorTwinForCustomer(customerId, input.userId);
      } else if (vendorId && !customerId) {
        customerId = await this.ensureCustomerTwinForVendor(vendorId, input.userId);
      }
    }

    if (input.role === 'musteri' && !customerId) {
      throw new BadRequestException('Müşteri carisi için müşteri gerekir');
    }
    if (input.role === 'tedarikci' && !vendorId) {
      throw new BadRequestException('Tedarikçi carisi için tedarikçi gerekir');
    }
    if (input.role === 'musteri_tedarikci' && (!customerId || !vendorId)) {
      throw new BadRequestException('Müşteri Ve Tedarikçi için her iki kart da gerekir');
    }

    const existing =
      input.role === 'musteri_tedarikci' && customerId && vendorId
        ? await this.coalesceDualPartyAccounts({
            customerId,
            vendorId,
          })
        : (customerId
            ? await this.coalesceLinkedPartyAccounts({ linkedCustomerId: customerId })
            : null) ||
          (vendorId
            ? await this.coalesceLinkedPartyAccounts({ linkedVendorId: vendorId })
            : null);

    const name = await this.resolveKarsiTarafCariAdi({
      name: input.name,
      customerId,
      vendorId,
    });

    if (existing) {
      await this.prisma.partyAccount.update({
        where: { id: existing.id },
        data: {
          kind: input.role,
          name: name.slice(0, 160),
          ...(customerId ? { linkedCustomerId: customerId } : {}),
          ...(vendorId ? { linkedVendorId: vendorId } : {}),
          isActive: true,
        },
      });
      await this.markCariTanimli();
      return existing;
    }

    const created = await this.prisma.partyAccount.create({
      data: {
        name: name.slice(0, 160),
        kind: input.role,
        linkedCustomerId: customerId,
        linkedVendorId: vendorId,
        createdByUserId: input.userId,
      },
    });
    await this.markCariTanimli();
    return { id: created.id };
  }

  private async resolveKarsiTarafCariAdi(input: {
    name?: string | null;
    customerId?: string | null;
    vendorId?: string | null;
  }): Promise<string> {
    const given = (input.name || '').trim();
    if (given) return given;
    if (input.customerId) {
      const c = await this.prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { shortName: true, companyName: true, fullName: true },
      });
      const n = c?.shortName || c?.companyName || c?.fullName;
      if (n?.trim()) return n.trim();
    }
    if (input.vendorId) {
      const v = await this.prisma.vendor.findUnique({
        where: { id: input.vendorId },
        select: { name: true },
      });
      if (v?.name?.trim()) return v.name.trim();
    }
    return 'Cari Hesap';
  }

  /** Müşteri kartından tedarikçi ikizi — vergi/T.C. ile eşler, yoksa açar. */
  private async ensureVendorTwinForCustomer(
    customerId: string,
    userId: string,
  ): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        entityType: true,
        shortName: true,
        companyName: true,
        fullName: true,
        taxNumber: true,
        taxOffice: true,
        identityNo: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        district: true,
        neighborhood: true,
        streetName: true,
        buildingNo: true,
        doorNo: true,
        authorizedPerson: true,
      },
    });
    if (!customer) throw new BadRequestException('Müşteri bulunamadı');

    const tax = customer.taxNumber?.replace(/\D/g, '') || null;
    const tc = customer.identityNo?.replace(/\D/g, '') || null;
    const isCorporate = customer.entityType === 'corporate';
    const kimlikHata = cariCiftRolKimlikHatasi({
      entityType: customer.entityType,
      taxNumber: tax,
      identityNo: tc,
    });
    if (kimlikHata) throw new BadRequestException(kimlikHata);

    if (tax || tc) {
      const existing = await this.prisma.vendor.findFirst({
        where: {
          OR: [
            ...(tax ? [{ taxNumber: tax }] : []),
            ...(tc ? [{ identityNo: tc }] : []),
          ],
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (existing) return existing.id;
    }

    const name =
      customer.shortName ||
      customer.companyName ||
      customer.fullName ||
      'Tedarikçi';
    const created = await this.prisma.vendor.create({
      data: {
        name: name.slice(0, 160),
        type: 'Diğer',
        entityType: isCorporate ? 'corporate' : 'individual',
        taxNumber: tax,
        taxOffice: customer.taxOffice || null,
        identityNo: tc,
        phone: customer.phone || null,
        email: customer.email || null,
        address: customer.address || null,
        city: customer.city || null,
        district: customer.district || null,
        neighborhood: customer.neighborhood || null,
        streetName: customer.streetName || null,
        buildingNo: customer.buildingNo || null,
        doorNo: customer.doorNo || null,
        authorizedPerson: customer.authorizedPerson || null,
        category: 'her_ikisi',
        notes: `Müşteri kartından ikiz (customerId=${customer.id})`,
        createdByUserId: userId,
      },
    });
    return created.id;
  }

  /** Tedarikçi kartından müşteri ikizi — vergi/T.C. ile eşler, yoksa açar. */
  private async ensureCustomerTwinForVendor(
    vendorId: string,
    userId: string,
  ): Promise<string> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        entityType: true,
        taxNumber: true,
        taxOffice: true,
        identityNo: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        district: true,
        neighborhood: true,
        streetName: true,
        buildingNo: true,
        doorNo: true,
        authorizedPerson: true,
      },
    });
    if (!vendor) throw new BadRequestException('Tedarikçi bulunamadı');

    const tax = vendor.taxNumber?.replace(/\D/g, '') || null;
    const tc = vendor.identityNo?.replace(/\D/g, '') || null;
    const isCorporate = vendor.entityType !== 'individual';
    const kimlikHata = cariCiftRolKimlikHatasi({
      entityType: isCorporate ? 'corporate' : 'individual',
      taxNumber: tax,
      identityNo: tc,
    });
    if (kimlikHata) throw new BadRequestException(kimlikHata);

    if (tax || tc) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          OR: [
            ...(tax ? [{ taxNumber: tax }] : []),
            ...(tc ? [{ identityNo: tc }] : []),
          ],
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (existing) return existing.id;
    }

    const shortName = (vendor.name || 'Müşteri').slice(0, 80);
    const created = await this.prisma.customer.create({
      data: {
        type: isCorporate ? 'corporate' : 'individual',
        entityType: isCorporate ? 'corporate' : 'individual',
        subType: 'private_customer',
        shortName,
        companyName: isCorporate ? vendor.name : null,
        fullName: isCorporate ? null : vendor.name,
        taxNumber: tax,
        taxOffice: vendor.taxOffice || null,
        identityNo: tc,
        phone: vendor.phone || null,
        email: vendor.email || null,
        address: vendor.address || null,
        city: vendor.city || null,
        district: vendor.district || null,
        neighborhood: vendor.neighborhood || null,
        streetName: vendor.streetName || null,
        buildingNo: vendor.buildingNo || null,
        doorNo: vendor.doorNo || null,
        authorizedPerson: vendor.authorizedPerson || null,
        notes: `Tedarikçi kartından ikiz (vendorId=${vendor.id})`,
        updatedByUserId: userId,
      },
    });
    return created.id;
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
   * Sigorta şirketi carisi — portal müşteri kartı varsa o;
   * yoksa kod: sigorta-{insuranceCompanyId} (tür: müşteri).
   */
  async ensureInsuranceCompanyAccount(input: {
    insuranceCompanyId: string;
    userId: string;
    name?: string | null;
  }): Promise<{ id: string }> {
    const insuranceCompanyId = String(input.insuranceCompanyId ?? '').trim();
    if (!insuranceCompanyId) {
      throw new BadRequestException('Sigorta şirketi seçimi zorunludur');
    }
    const portalCustomer = await this.prisma.customer.findFirst({
      where: { insuranceCompanyId, status: 'active' },
      select: {
        id: true,
        shortName: true,
        companyName: true,
        fullName: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (portalCustomer) {
      return this.ensureCustomerAccount({
        customerId: portalCustomer.id,
        userId: input.userId,
        name:
          input.name ||
          portalCustomer.shortName ||
          portalCustomer.companyName ||
          portalCustomer.fullName,
      });
    }

    const code = `sigorta-${insuranceCompanyId}`;
    const existing = await this.prisma.partyAccount.findFirst({
      where: { code, isActive: true },
      select: { id: true },
    });
    if (existing) return existing;

    const company = await this.prisma.insuranceCompany.findUnique({
      where: { id: insuranceCompanyId },
      select: { id: true, name: true },
    });
    if (!company) throw new BadRequestException('Sigorta şirketi bulunamadı');
    const name =
      (input.name || '').trim() || company.name || 'Sigorta Şirketi Carisi';
    const created = await this.prisma.partyAccount.create({
      data: {
        code,
        name: name.slice(0, 160),
        kind: 'musteri',
        notes: `Sigorta şirketi cari (insuranceCompanyId=${insuranceCompanyId})`,
        createdByUserId: input.userId,
      },
    });
    await this.markCariTanimli();
    return { id: created.id };
  }

  /** Sigorta tahsilatı → sigorta carisinde Alacak. */
  async postTahsilatAlacakInsurance(input: {
    insuranceCompanyId: string;
    paymentId: string;
    amount: number;
    entryDate: Date | string;
    description: string;
    userId: string;
    insuranceName?: string | null;
  }) {
    const amount = round2(input.amount);
    if (amount <= 0) return null;
    const existing = await this.findExistingSourceEntry('tahsilat', input.paymentId);
    if (existing) return existing;
    const account = await this.ensureInsuranceCompanyAccount({
      insuranceCompanyId: input.insuranceCompanyId,
      userId: input.userId,
      name: input.insuranceName,
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

  /** Banka hesabı carisi yoksa açar (kod: banka-{bankAccountId}). */
  async ensureBankAccount(input: {
    bankAccountId: string;
    userId: string;
    name?: string | null;
    isActive?: boolean;
  }): Promise<{ id: string }> {
    const bankAccountId = String(input.bankAccountId || '').trim();
    if (!bankAccountId) throw new BadRequestException('Banka hesabı gerekli');
    const code = bankaCariKodu(bankAccountId);
    const existing = await this.prisma.partyAccount.findFirst({
      where: { code },
      select: { id: true, isActive: true, name: true },
    });
    const bank = await this.prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { id: true, bankName: true, branchName: true, iban: true, isActive: true },
    });
    if (!bank) throw new BadRequestException('Banka hesabı bulunamadı');
    const name =
      (input.name || '').trim() ||
      [bank.bankName, bank.branchName].filter(Boolean).join(' · ') ||
      'Banka Hesabı';
    const active =
      typeof input.isActive === 'boolean' ? input.isActive : bank.isActive !== false;
    if (existing) {
      await this.prisma.partyAccount.update({
        where: { id: existing.id },
        data: {
          name: name.slice(0, 160),
          kind: 'banka',
          isActive: active,
          notes: `Banka hesabı (bankAccountId=${bankAccountId}; IBAN=${bank.iban})`,
        },
      });
      return { id: existing.id };
    }
    const created = await this.prisma.partyAccount.create({
      data: {
        code,
        name: name.slice(0, 160),
        kind: 'banka',
        notes: `Banka hesabı (bankAccountId=${bankAccountId}; IBAN=${bank.iban})`,
        isActive: active,
        createdByUserId: input.userId,
      },
    });
    await this.markCariTanimli();
    return { id: created.id };
  }

  /** Eldeki nakit kasa carisi (method=cash). */
  async ensureNakitKasaAccount(input: { userId: string }): Promise<{ id: string }> {
    const existing = await this.prisma.partyAccount.findFirst({
      where: { code: NAKIT_KASA_CARI_KODU },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.partyAccount.update({
        where: { id: existing.id },
        data: { kind: 'banka', isActive: true, name: 'Nakit Kasa' },
      });
      return existing;
    }
    const created = await this.prisma.partyAccount.create({
      data: {
        code: NAKIT_KASA_CARI_KODU,
        name: 'Nakit Kasa',
        kind: 'banka',
        notes: 'Eldeki nakit (tahsilat / ödeme method=cash)',
        createdByUserId: input.userId,
      },
    });
    await this.markCariTanimli();
    return { id: created.id };
  }

  /**
   * Tahsilat / ödeme nakit ayağı — banka veya kasa carisine.
   * Giriş → Borç (nakit artar). Çıkış → Alacak (nakit azalır).
   * Kaynak: nakit + paymentId (karşı taraf tahsilat/ödeme satırından ayrı).
   */
  async postNakitHareket(input: {
    paymentId: string;
    amount: number;
    entryDate: Date | string;
    description: string;
    userId: string;
    direction: 'giris' | 'cikis';
    bankAccountId?: string | null;
    useNakitKasa?: boolean;
  }) {
    const amount = round2(input.amount);
    if (amount <= 0) return null;
    const existing = await this.findExistingSourceEntry('nakit', input.paymentId);
    if (existing) return existing;

    let account: { id: string } | null = null;
    if (input.bankAccountId) {
      account = await this.ensureBankAccount({
        bankAccountId: input.bankAccountId,
        userId: input.userId,
      });
    } else if (input.useNakitKasa) {
      account = await this.ensureNakitKasaAccount({ userId: input.userId });
    }
    if (!account) return null;

    const entryDate = await this.entryDateIso(input.entryDate);
    const giris = input.direction === 'giris';
    return this.prisma.partyAccountEntry.create({
      data: {
        accountId: account.id,
        entryDate: new Date(entryDate),
        description: input.description.slice(0, 240) || (giris ? 'Nakit Giriş' : 'Nakit Çıkış'),
        debitAmount: giris ? amount : 0,
        creditAmount: giris ? 0 : amount,
        sourceKind: 'nakit',
        sourceId: input.paymentId,
        createdByUserId: input.userId,
      },
    });
  }

  private async loadHedefCiroKayit() {
    return normalizeFinansHedefCiro(
      await this.settings.get(FINANS_HEDEF_CIRO_AYAR_KEY),
    );
  }

  /** Seçilen ayda hangi sabit kalemler cariye düşülmüş. */
  async listIsletmeSabitDusumDurum(year: number, month: number) {
    const y = Math.trunc(Number(year));
    const m = Math.trunc(Number(month));
    if (!Number.isFinite(y) || y < 2000 || y > 2100 || !Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException('Geçerli yıl ve ay seçin.');
    }
    const hedef = await this.loadHedefCiroKayit();
    const postedKalemIds: string[] = [];
    for (const k of hedef.isletmeSabitKalemleri) {
      const sourceId = finansIsletmeSabitSourceId(k.id, y, m);
      const existing = await this.findExistingSourceEntry('sabit', sourceId);
      if (existing) postedKalemIds.push(k.id);
    }
    return {
      year: y,
      month: m,
      postedKalemIds,
      entryDate: finansIsletmeSabitEntryDateIso(y, m),
    };
  }

  /**
   * Aktif işletme sabitlerini seçilen ayda cariye düşer (masraf ile aynı Alacak sütunu).
   * Aynı kalem + ay ikinci kez yazılmaz. Ödeme kaydı değildir.
   */
  async postIsletmeSabitAylikDusum(input: {
    year: number;
    month: number;
    actorUserId: string;
  }): Promise<FinansIsletmeSabitDusumOzet> {
    const y = Math.trunc(Number(input.year));
    const m = Math.trunc(Number(input.month));
    if (!Number.isFinite(y) || y < 2000 || y > 2100 || !Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException('Geçerli yıl ve ay seçin.');
    }
    const entryDate = finansIsletmeSabitEntryDateIso(y, m);
    await this.assertEntryDateOpen(entryDate);
    const hedef = await this.loadHedefCiroKayit();
    const period = `${y}-${String(m).padStart(2, '0')}`;
    let posted = 0;
    let skippedAlready = 0;
    let skippedNoCari = 0;
    let skippedInactive = 0;
    const postedKalemIds: string[] = [];

    for (const k of hedef.isletmeSabitKalemleri) {
      if (k.durum !== 'aktif' || !(Number(k.aylikTutar) > 0.005)) {
        skippedInactive += 1;
        continue;
      }
      if (!finansIsletmeSabitAktifAyda(k, y, m)) {
        if (!String(k.partyAccountId ?? '').trim()) skippedNoCari += 1;
        else skippedInactive += 1;
        continue;
      }
      const sourceId = finansIsletmeSabitSourceId(k.id, y, m);
      const existing = await this.findExistingSourceEntry('sabit', sourceId);
      if (existing) {
        skippedAlready += 1;
        postedKalemIds.push(k.id);
        continue;
      }
      await this.findOne(k.partyAccountId);
      const amount = round2(Number(k.aylikTutar));
      await this.prisma.partyAccountEntry.create({
        data: {
          accountId: k.partyAccountId,
          entryDate: new Date(entryDate),
          description: `${k.ad} · ${period}`.slice(0, 240),
          debitAmount: 0,
          creditAmount: amount,
          sourceKind: 'sabit',
          sourceId,
          createdByUserId: input.actorUserId,
        },
      });
      posted += 1;
      postedKalemIds.push(k.id);
    }

    return {
      year: y,
      month: m,
      posted,
      skippedAlready,
      skippedNoCari,
      skippedInactive,
      postedKalemIds,
    };
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

  /** Ödeme kaydı için bağlı cari hesap (liste / ekstre linki). */
  async resolvePartyAccountForPayment(input: {
    paymentType: string;
    payerType: string;
    payerId?: string | null;
    claimCustomerId?: string | null;
    claimInsuranceCompanyId?: string | null;
  }): Promise<{ id: string; name: string } | null> {
    if (input.paymentType === 'outgoing' && input.payerType === 'vendor' && input.payerId) {
      const coalesced = await this.coalesceLinkedPartyAccounts({
        linkedVendorId: input.payerId,
      });
      if (!coalesced) return null;
      const row = await this.prisma.partyAccount.findUnique({
        where: { id: coalesced.id },
        select: { id: true, name: true },
      });
      return row ? { id: row.id, name: row.name } : null;
    }
    const customerId =
      input.claimCustomerId ||
      (input.paymentType === 'incoming' && input.payerType === 'customer'
        ? input.payerId
        : null);
    if (input.paymentType === 'incoming' && customerId) {
      const coalesced = await this.coalesceLinkedPartyAccounts({
        linkedCustomerId: customerId,
      });
      if (!coalesced) return null;
      const row = await this.prisma.partyAccount.findUnique({
        where: { id: coalesced.id },
        select: { id: true, name: true },
      });
      return row ? { id: row.id, name: row.name } : null;
    }
    if (input.paymentType === 'incoming') {
      const insuranceCompanyId =
        (input.payerType === 'insurance_company' ? input.payerId : null) ||
        input.claimInsuranceCompanyId ||
        null;
      if (insuranceCompanyId) {
        const portalCustomer = await this.prisma.customer.findFirst({
          where: { insuranceCompanyId, status: 'active' },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });
        if (portalCustomer) {
          const coalesced = await this.coalesceLinkedPartyAccounts({
            linkedCustomerId: portalCustomer.id,
          });
          if (coalesced) {
            const row = await this.prisma.partyAccount.findUnique({
              where: { id: coalesced.id },
              select: { id: true, name: true },
            });
            if (row) return { id: row.id, name: row.name };
          }
        }
        const code = `sigorta-${insuranceCompanyId}`;
        const row = await this.prisma.partyAccount.findFirst({
          where: { code, isActive: true },
          select: { id: true, name: true },
        });
        return row ? { id: row.id, name: row.name } : null;
      }
    }
    return null;
  }

  async resolvePartyAccountIdForPayment(input: {
    paymentType: string;
    payerType: string;
    payerId?: string | null;
    claimCustomerId?: string | null;
    claimInsuranceCompanyId?: string | null;
  }): Promise<string | null> {
    const row = await this.resolvePartyAccountForPayment(input);
    return row?.id ?? null;
  }
}
