import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FILE_FEE_CUSTOMER_SOURCE,
  HASAR_TESPIT_ARAC_AYAR_KEY,
  HASAR_TESPIT_BEDEL_LOG_KIND,
  HASAR_TESPIT_FEE_DESCRIPTION,
  HASAR_TESPIT_TARIFE_KEY,
  bedelGiderKategorisi,
  bedelGiderSatirlari,
  hesaplaHasarTespitBedeli,
  isInspectionServiceKind,
  normalizeHasarTespitArac,
  normalizeHasarTespitTarife,
  rotaGecisleri,
  type HasarTespitAracAyarlari,
  type HasarTespitBedelGirdi,
  type HasarTespitTarife,
  type YakitTuru,
} from '@sigorta/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { LocationsService } from '@/modules/locations/locations.service';
import { ClaimFileRevenueService } from '@/modules/finance/claim-file-revenue.service';
import { ExpensesService } from '@/modules/expenses/expenses.service';
import { akaryakitFiyatiOku, type AkaryakitFiyatSonuc } from './akaryakit-fiyat.util';
import { rotaHesapla } from './rota.util';

const AKARYAKIT_ONBELLEK_KEY = 'akaryakit_fiyat_onbellek';

export interface GelireDusurBody {
  cikisAdresi?: string;
  rotaKm: number;
  gidisDonus?: boolean;
  yakitTuru?: YakitTuru;
  yakitFiyati?: number | null;
  yakitKaynak?: string | null;
  gun?: number;
  gecisler?: Array<{ id: string; ad: string; adet: number; ucret: number | null }>;
  otoyollar?: Array<{ ref: string; ad?: string; km: number; kmUcreti: number | null }>;
  ekMiktarlar?: Record<string, number>;
}

function customerName(c: {
  shortName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null | undefined): string {
  if (!c) return '';
  return c.shortName || c.companyName || c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || '';
}

function nonNegative(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

@Injectable()
export class HasarTespitBedelService {
  private readonly logger = new Logger(HasarTespitBedelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly locations: LocationsService,
    private readonly revenues: ClaimFileRevenueService,
    private readonly expenses: ExpensesService,
  ) {}

  private async readSetting(key: string): Promise<unknown> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  private async writeSetting(key: string, value: unknown): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as any },
      update: { value: value as any },
    });
  }

  async getArac(): Promise<HasarTespitAracAyarlari> {
    return normalizeHasarTespitArac(await this.readSetting(HASAR_TESPIT_ARAC_AYAR_KEY));
  }

  async setArac(body: unknown): Promise<HasarTespitAracAyarlari> {
    const next = normalizeHasarTespitArac(body);
    await this.writeSetting(HASAR_TESPIT_ARAC_AYAR_KEY, next);
    return next;
  }

  private async tarifeMap(): Promise<Record<string, unknown>> {
    const raw = await this.readSetting(HASAR_TESPIT_TARIFE_KEY);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  }

  async getTarife(customerId: string): Promise<{ tarife: HasarTespitTarife; kayitli: boolean }> {
    const map = await this.tarifeMap();
    const raw = map[customerId];
    return { tarife: normalizeHasarTespitTarife(raw), kayitli: raw != null };
  }

  async setTarife(customerId: string, body: unknown): Promise<HasarTespitTarife> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı');
    const map = await this.tarifeMap();
    const next = normalizeHasarTespitTarife(body);
    map[customerId] = next;
    await this.writeSetting(HASAR_TESPIT_TARIFE_KEY, map);
    return next;
  }

  async akaryakit(il: string, ilce: string | null, tur: YakitTuru): Promise<AkaryakitFiyatSonuc> {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `${il}|${ilce ?? ''}|${tur}`.toLocaleUpperCase('tr-TR');
    const raw = (await this.readSetting(AKARYAKIT_ONBELLEK_KEY)) as { tarih?: string; satirlar?: Record<string, AkaryakitFiyatSonuc> } | null;
    const cache = raw?.tarih === today && raw.satirlar ? raw.satirlar : {};
    if (cache[cacheKey]?.fiyat) return cache[cacheKey];
    const sonuc = await akaryakitFiyatiOku({
      il,
      ilce,
      tur,
      apiKey: this.config.get<string>('OPENAI_API_KEY') ?? null,
    });
    if (sonuc.fiyat) {
      await this.writeSetting(AKARYAKIT_ONBELLEK_KEY, { tarih: today, satirlar: { ...cache, [cacheKey]: sonuc } })
        .catch((err) => this.logger.warn(`Akaryakıt önbelleği yazılamadı: ${err}`));
    }
    return sonuc;
  }

  private async loadInspectionFile(claimFileId: string) {
    const file = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: {
        id: true,
        fileNo: true,
        serviceKind: true,
        customerId: true,
        notificationDate: true,
        customer: {
          select: { id: true, shortName: true, companyName: true, fullName: true, firstName: true, lastName: true },
        },
        propertyAddress: {
          select: { addressLine: true, district: true, city: true, latitude: true, longitude: true },
        },
      },
    });
    if (!file) throw new NotFoundException('Dosya bulunamadı');
    if (!isInspectionServiceKind(file.serviceKind)) {
      throw new BadRequestException('Hizmet bedeli hesabı Hasar Tespit dosyasındadır.');
    }
    return file;
  }

  private hedefAdres(file: Awaited<ReturnType<HasarTespitBedelService['loadInspectionFile']>>): string {
    const a = file.propertyAddress;
    if (!a) return '';
    return [a.addressLine, a.district, a.city].filter((p) => p && String(p).trim()).join(', ');
  }

  async dosyaOzeti(claimFileId: string) {
    const file = await this.loadInspectionFile(claimFileId);
    const [arac, tarifeRes, feeRevenue, lastLog] = await Promise.all([
      this.getArac(),
      file.customerId ? this.getTarife(file.customerId) : Promise.resolve({ tarife: normalizeHasarTespitTarife(null), kayitli: false }),
      this.prisma.claimFileRevenue.findFirst({
        where: { claimFileId, revenueType: 'file_fee', status: { not: 'cancelled' } },
        select: { id: true, amount: true, entryDate: true },
      }),
      this.prisma.fileActivityLog.findFirst({
        where: { claimFileId, metadata: { path: ['kind'], equals: HASAR_TESPIT_BEDEL_LOG_KIND } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, metadata: true, description: true },
      }),
    ]);
    return {
      dosya: {
        id: file.id,
        fileNo: file.fileNo,
        musteriId: file.customerId,
        musteriAdi: customerName(file.customer),
        hedefAdres: this.hedefAdres(file),
        il: file.propertyAddress?.city ?? null,
        ilce: file.propertyAddress?.district ?? null,
        tarih: file.notificationDate,
      },
      arac,
      tarife: tarifeRes.tarife,
      tarifeKayitli: tarifeRes.kayitli,
      hizmetBedeli: feeRevenue,
      sonHesap: lastLog ? { tarih: lastLog.createdAt, ...(lastLog.metadata as Record<string, unknown>) } : null,
    };
  }

  private async geocode(adres: string) {
    const q = adres.trim();
    if (!q) return null;
    const direct = await this.locations.geocodeQuery(q);
    if (direct) return direct;
    const parts = q.split(',').map((p) => p.trim()).filter(Boolean);
    for (let i = 1; i < parts.length - 1; i += 1) {
      const hit = await this.locations.geocodeQuery(parts.slice(i).join(', '));
      if (hit) return hit;
    }
    return null;
  }

  async rota(claimFileId: string, cikisAdresi: string) {
    const file = await this.loadInspectionFile(claimFileId);
    if (!cikisAdresi?.trim()) throw new BadRequestException('Çıkış adresini yazın.');
    const cikis = await this.geocode(cikisAdresi);
    if (!cikis) throw new BadRequestException('Çıkış adresi haritada bulunamadı. Adresi ilçe ve il ile yazın.');
    const a = file.propertyAddress;
    const hedef = a?.latitude != null && a?.longitude != null
      ? { lat: a.latitude, lng: a.longitude, displayName: this.hedefAdres(file) }
      : await this.geocode(this.hedefAdres(file));
    if (!hedef) throw new BadRequestException('Tespit adresi haritada bulunamadı. Km’yi elle yazın.');
    const rota = await rotaHesapla({ lat: cikis.lat, lng: cikis.lng }, { lat: hedef.lat, lng: hedef.lng });
    if (!rota) throw new BadRequestException('Rota hesaplanamadı. Km’yi elle yazın.');
    const arac = await this.getArac();
    return {
      km: rota.km,
      dakika: rota.dakika,
      gecisler: rotaGecisleri(rota.koordinatlar, arac.gecisler),
      otoyollar: rota.otoyollar,
      cikis: { lat: cikis.lat, lng: cikis.lng, ad: cikis.displayName },
      hedef: { lat: hedef.lat, lng: hedef.lng, ad: hedef.displayName },
    };
  }

  private buildGirdi(
    body: GelireDusurBody,
    arac: HasarTespitAracAyarlari,
    tarife: HasarTespitTarife,
  ): HasarTespitBedelGirdi {
    const rotaKm = nonNegative(body.rotaKm);
    if (rotaKm == null || rotaKm <= 0) throw new BadRequestException('Rota km’si girilmeden hesap yapılmaz.');
    const gun = nonNegative(body.gun) ?? 1;
    return {
      rotaKm,
      gidisDonus: body.gidisDonus !== false,
      yakitTuru: body.yakitTuru === 'benzin' || body.yakitTuru === 'lpg' ? body.yakitTuru : arac.yakitTuru,
      yakitFiyati: nonNegative(body.yakitFiyati),
      tuketimL100: arac.tuketimL100,
      kmAsimUcreti: arac.kmAsimUcreti,
      aylikKira: arac.aylikKira,
      gun: gun > 0 ? gun : 1,
      tarih: new Date(),
      gecisler: (body.gecisler ?? [])
        .filter((g) => g && typeof g.ad === 'string')
        .map((g) => ({ id: String(g.id), ad: String(g.ad), adet: Math.max(0, Math.round(Number(g.adet) || 0)), ucret: nonNegative(g.ucret) })),
      otoyollar: (body.otoyollar ?? [])
        .filter((o) => o && typeof o.ref === 'string')
        .map((o) => ({ ref: String(o.ref), ad: o.ad, km: nonNegative(o.km) ?? 0, kmUcreti: nonNegative(o.kmUcreti) })),
      tarife,
      ekMiktarlar: body.ekMiktarlar ?? {},
    };
  }

  async gelireDusur(claimFileId: string, body: GelireDusurBody, user: { id?: string; roleCode?: string } | undefined) {
    const userId = String(user?.id ?? '').trim();
    if (!userId) throw new BadRequestException('Oturum bulunamadı.');
    const file = await this.loadInspectionFile(claimFileId);
    const existing = await this.prisma.claimFileRevenue.findFirst({
      where: { claimFileId, revenueType: 'file_fee', status: { not: 'cancelled' } },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Bu dosyada Hasar Tespit Hizmet Bedeli zaten gelirde. Değiştirmek için Finans → Gelir’deki kaydı düzeltin.');
    }
    const arac = await this.getArac();
    const { tarife } = file.customerId
      ? await this.getTarife(file.customerId)
      : { tarife: normalizeHasarTespitTarife(null) };
    const girdi = this.buildGirdi(body, arac, tarife);
    const sonuc = hesaplaHasarTespitBedeli(girdi);
    if (sonuc.bedel <= 0) throw new BadRequestException('Hizmet bedeli sıfır çıktı. Eksik fiyatları tamamlayın.');

    const revenue = await this.revenues.create(
      claimFileId,
      {
        revenueType: 'file_fee',
        collectionSource: FILE_FEE_CUSTOMER_SOURCE,
        description: HASAR_TESPIT_FEE_DESCRIPTION,
        amount: sonuc.bedel,
        billed: true,
        vatRate: 20,
        entryDate: new Date().toISOString().slice(0, 10),
        notes: 'Hizmet Bedeli Hesabı',
      } as any,
      userId,
    );

    const giderIds: string[] = [];
    const giderHatalari: string[] = [];
    const dateIso = new Date().toISOString();
    for (const satir of bedelGiderSatirlari(sonuc)) {
      const kat = bedelGiderKategorisi(satir.kod);
      const category = kat.kategoriKodu
        ? await this.prisma.expenseCategory.findFirst({ where: { code: kat.kategoriKodu }, select: { id: true } })
        : null;
      try {
        const created = await this.expenses.create(
          {
            date: dateIso,
            amount: satir.tutar,
            vatRate: 20,
            vatIncluded: true,
            description: `${satir.ad} · ${file.fileNo}`,
            ...(category ? { expenseCategoryId: category.id } : { expenseGroup: 'OPERASYON_GIDERLERI', expenseSubgroup: kat.altGrup }),
            expensePlan: 'BUTCELENEN',
            fileCaseId: claimFileId,
          } as any,
          userId,
        );
        if (created?.id) giderIds.push(created.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Hasar Tespit gideri yazılamadı (${file.fileNo} ${satir.kod}): ${msg}`);
        giderHatalari.push(`${satir.ad}: ${msg}`);
      }
    }

    await this.prisma.fileActivityLog.create({
      data: {
        claimFileId,
        action: 'NOTE_ADDED' as any,
        actorId: userId,
        actorRole: String(user?.roleCode ?? 'office_staff'),
        description: 'Hasar Tespit Hizmet Bedeli gelire düşürüldü.',
        metadata: {
          kind: HASAR_TESPIT_BEDEL_LOG_KIND,
          cikisAdresi: body.cikisAdresi ?? null,
          yakitKaynak: body.yakitKaynak ?? null,
          girdi: { ...girdi, tarih: girdi.tarih.toISOString() },
          sonuc,
          revenueId: (revenue as { id?: string })?.id ?? null,
          giderIds,
          giderHatalari,
        } as any,
      },
    });

    return {
      sonuc,
      revenueId: (revenue as { id?: string })?.id ?? null,
      giderSayisi: giderIds.length,
      giderHatalari,
    };
  }
}
