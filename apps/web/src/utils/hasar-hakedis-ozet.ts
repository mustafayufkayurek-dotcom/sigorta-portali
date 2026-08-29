import {
  isAvansPayment,
  isHakedisMahsupPayment,
  netHakedisAfterAvans,
  parseAvansMahsupFromNote,
} from '@sigorta/shared';

export type HakedisKaynak =
  | 'dosya'
  | 'teklif'
  | 'onceki_hakedis'
  | 'avans'
  | 'metraj'
  | 'ilerleme';

export const HAKEDIS_KAYNAK_ETIKET: Record<HakedisKaynak, string> = {
  dosya: 'Dosyadan getirildi',
  teklif: 'Teklif/Bütçeden',
  onceki_hakedis: 'Önceki hakedişlerden hesaplandı',
  avans: 'Avans işlemlerinden hesaplandı',
  metraj: 'Metrajdan hesaplandı',
  ilerleme: 'İş ilerlemesinden hesaplandı',
};

export function roundTry(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export type HakedisOzetAlan = {
  key: string;
  label: string;
  amount: number | null;
  kaynak: HakedisKaynak;
};

export type HakedisOzet = {
  sozlesme: HakedisOzetAlan;
  onayliHakedis: HakedisOzetAlan;
  buTalep: HakedisOzetAlan;
  kalanSozlesme: HakedisOzetAlan;
  toplamAvans: HakedisOzetAlan;
  kullanilanAvans: HakedisOzetAlan;
  kalanAvans: HakedisOzetAlan;
  onerilen: HakedisOzetAlan;
  netOdenecek: number;
  uyarilar: string[];
  eksikler: string[];
};

export type AvansIslem = {
  id: string;
  tarih?: string;
  tip: 'talep' | 'odeme' | 'mahsup';
  tipLabel: string;
  tutar: number;
  durum: string;
  baglanti?: string;
  kaynak: HakedisKaynak;
};

export type OdemePlanSatir = {
  id: string;
  tarih?: string;
  vade?: string;
  tutar: number;
  durum: string;
  baglanti?: string;
  tip?: 'hakedis' | 'avans';
  tipLabel?: string;
};

export const HASAR_AVANS_LIMIT_ORAN = 0.2;

export function resolveHasarAvansLimit(sozlesmeTutari: number | null | undefined): number | null {
  if (sozlesmeTutari == null || sozlesmeTutari <= 0) return null;
  return roundTry(sozlesmeTutari * HASAR_AVANS_LIMIT_ORAN);
}

export function hakedisTutarKirilim(input: {
  totalAmount?: number | null;
  items?: Array<{ totalAmount?: number | null; vatRate?: number | null }>;
}): { net: number; kdv: number; toplam: number } {
  const items = input.items ?? [];
  if (items.length > 0) {
    let net = 0;
    let kdv = 0;
    for (const item of items) {
      const brut = roundTry(Number(item.totalAmount) || 0);
      const rate = Number(item.vatRate) || 0;
      const itemNet = rate > 0 ? roundTry(brut / (1 + rate / 100)) : brut;
      net += itemNet;
      kdv += roundTry(brut - itemNet);
    }
    return { net: roundTry(net), kdv: roundTry(kdv), toplam: roundTry(net + kdv) };
  }
  const toplam = roundTry(Number(input.totalAmount) || 0);
  return { net: toplam, kdv: 0, toplam };
}

export function hakedisDurumEtiket(input: {
  status?: string | null;
  odemeDurumu?: string | null;
}): string {
  const status = String(input.status ?? '').toUpperCase();
  const odeme = String(input.odemeDurumu ?? '').toLowerCase();
  if (odeme === 'completed') return 'Ödendi';
  if (status === 'DRAFT') return 'Taslak';
  if (odeme === 'pending') return 'Ödeme Bekliyor';
  if (status === 'APPROVED') return 'Onaylandı';
  if (status === 'SENT' || status === 'PARTIALLY_APPROVED') return 'Onay Bekliyor';
  if (status === 'DISPUTED') return 'İtirazlı';
  if (status === 'CLOSED') return 'Tamamlandı';
  if (!status) return '—';
  return status;
}

export type HakedisAkisAdim = {
  id: 'taslak' | 'kontrol' | 'onay' | 'odeme' | 'tamamlandi';
  label: string;
  durum: 'tamam' | 'aktif' | 'bekler';
  tarih?: string | null;
  kisi?: string | null;
};

export function personLabel(user?: { firstName?: string | null; lastName?: string | null } | null): string | null {
  const t = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return t || null;
}

/** Domain durumları: DRAFT→Taslak, SENT→Kontrol, APPROVED→Onay, pending payment→Ödeme, completed→Tamamlandı */
export function buildHakedisAkis(input: {
  status?: string | null;
  createdAt?: string | null;
  sentAt?: string | null;
  autoApprovedAt?: string | null;
  createdBy?: { firstName?: string | null; lastName?: string | null } | null;
  odemeDurumu?: string | null;
  odemeTarihi?: string | null;
  vade?: string | null;
}): HakedisAkisAdim[] {
  const status = String(input.status ?? '').toUpperCase();
  const odeme = String(input.odemeDurumu ?? '').toLowerCase();
  const olusturan = personLabel(input.createdBy);
  const taslakTamam = Boolean(input.createdAt);
  const kontrolTamam = Boolean(input.sentAt || input.autoApprovedAt || status === 'APPROVED' || odeme);
  const onayTamam = Boolean(input.autoApprovedAt || status === 'APPROVED' || odeme === 'completed' || odeme === 'pending');
  const odemeTamam = odeme === 'completed';
  const odemeAktif = odeme === 'pending' || (onayTamam && !odemeTamam && Boolean(input.vade || input.odemeTarihi));
  const tamamlandi = odemeTamam;
  return [
    {
      id: 'taslak',
      label: 'Taslak',
      durum: taslakTamam ? 'tamam' : 'aktif',
      tarih: input.createdAt,
      kisi: olusturan,
    },
    {
      id: 'kontrol',
      label: 'Kontrol',
      durum: kontrolTamam ? 'tamam' : taslakTamam ? 'aktif' : 'bekler',
      tarih: input.sentAt ?? (kontrolTamam ? input.autoApprovedAt : null),
      kisi: kontrolTamam && !input.sentAt ? 'Otomatik' : null,
    },
    {
      id: 'onay',
      label: 'Onay',
      durum: onayTamam ? 'tamam' : kontrolTamam ? 'aktif' : 'bekler',
      tarih: input.autoApprovedAt,
      kisi: onayTamam ? 'Otomatik' : null,
    },
    {
      id: 'odeme',
      label: 'Ödeme',
      durum: odemeTamam ? 'tamam' : odemeAktif ? 'aktif' : 'bekler',
      tarih: odemeTamam ? input.odemeTarihi : input.vade,
      kisi: null,
    },
    {
      id: 'tamamlandi',
      label: 'Tamamlandı',
      durum: tamamlandi ? 'tamam' : odemeTamam ? 'aktif' : 'bekler',
      tarih: tamamlandi ? input.odemeTarihi : null,
      kisi: null,
    },
  ];
}

/** Dönem etiketi — periodStart/End varsa ay adı, yoksa oluşturulma ayı */
export function hakedisDonemEtiket(input: {
  periodStart?: string | Date | null;
  periodEnd?: string | Date | null;
  createdAt?: string | Date | null;
}): string {
  const raw = input.periodStart ?? input.periodEnd ?? input.createdAt;
  if (!raw) return '—';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

export function hakedisKesintiNet(input: {
  totalAmount?: number | null;
  notes?: string | null;
  items?: Array<{ totalAmount?: number | null; vatRate?: number | null }>;
}): { hakedisTutari: number; kesintiler: number; netTutar: number } {
  const kirilim = hakedisTutarKirilim(input);
  const kesintiler = roundTry(parseAvansMahsupFromNote(input.notes));
  const hakedisTutari = kirilim.toplam;
  return {
    hakedisTutari,
    kesintiler,
    netTutar: roundTry(Math.max(0, hakedisTutari - kesintiler)),
  };
}

export function hakedisGerceklesmeOrani(
  sozlesme: number | null | undefined,
  toplamHakedis: number | null | undefined,
): number | null {
  if (sozlesme == null || sozlesme <= 0 || toplamHakedis == null) return null;
  return Math.round(((toplamHakedis / sozlesme) * 1000)) / 10;
}

export type OdemePlanOzet = {
  onaylanan: number | null;
  odenen: number;
  bekleyen: number;
  kalan: number | null;
  planlanan: number;
  buAy: number;
  yaklasan: number;
  satirlar: OdemePlanSatir[];
};

export { parseAvansMahsupFromNote };

export function classifyHakedisBelge(doc: {
  documentKind?: string | null;
  documentTypeName?: string | null;
}): 'onerilen' | 'ozel' {
  const kind = String(doc.documentKind ?? '').toLocaleLowerCase('tr-TR');
  const name = String(doc.documentTypeName ?? '').toLocaleLowerCase('tr-TR');
  const blob = `${kind} ${name}`;
  if (
    /muvafakat|anket|matbu|tespit|eksper|metraj|teklif|bütçe|butce|onay|mutabakat|foto|saha|iş emri|is emri/.test(blob)
  ) {
    return 'onerilen';
  }
  return 'ozel';
}

export function buildHasarHakedisOzet(input: {
  sozlesmeTutari?: number | null;
  sozlesmeKaynak?: HakedisKaynak;
  onayliHakedisToplam?: number | null;
  buTalepBrut?: number | null;
  onerilenTutar?: number | null;
  onerilenKaynak?: HakedisKaynak;
  avansToplam?: number | null;
  oncekiMahsupToplam?: number | null;
}): HakedisOzet {
  const sozlesme = input.sozlesmeTutari != null && input.sozlesmeTutari > 0
    ? roundTry(input.sozlesmeTutari)
    : null;
  const onayli = input.onayliHakedisToplam != null
    ? roundTry(Math.max(0, input.onayliHakedisToplam))
    : null;
  const brut = input.buTalepBrut != null && input.buTalepBrut > 0
    ? roundTry(input.buTalepBrut)
    : null;
  const onerilen = input.onerilenTutar != null && input.onerilenTutar > 0
    ? roundTry(input.onerilenTutar)
    : null;
  const avans = input.avansToplam != null
    ? roundTry(Math.max(0, input.avansToplam))
    : null;
  const oncekiMahsup = roundTry(Math.max(0, input.oncekiMahsupToplam ?? 0));
  const buMahsup = avans != null && brut != null
    ? roundTry(Math.max(0, brut - netHakedisAfterAvans(brut, Math.max(0, avans - oncekiMahsup))))
    : 0;
  const kullanilan = avans == null
    ? null
    : roundTry(Math.min(avans, oncekiMahsup + buMahsup));
  const kalanAvans = avans == null || kullanilan == null
    ? null
    : roundTry(Math.max(0, avans - kullanilan));
  const net = brut == null
    ? 0
    : netHakedisAfterAvans(brut, avans == null ? 0 : Math.max(0, avans - oncekiMahsup));
  const kalanSozlesme = sozlesme == null || onayli == null
    ? null
    : roundTry(sozlesme - onayli - (brut ?? 0));

  const eksikler: string[] = [];
  if (sozlesme == null) eksikler.push('Sözleşme / tedarikçi bütçesi dosyada yok.');
  if (onerilen == null && brut == null) eksikler.push('Önerilen hakediş tutarı yok. Talep tutarını yazın.');

  const uyarilar: string[] = [];
  if (sozlesme != null && onayli != null && brut != null && onayli + brut > sozlesme + 0.009) {
    uyarilar.push('Bu talep sözleşme bakiyesini aşıyor.');
  }
  if (avans != null && brut != null && avans - oncekiMahsup > brut) {
    uyarilar.push('Kullanılabilir avans bu talepten büyük; mahsup talebi kapatır.');
  }

  const alan = (
    key: string,
    label: string,
    amount: number | null,
    kaynak: HakedisKaynak,
  ): HakedisOzetAlan => ({ key, label, amount, kaynak });

  return {
    sozlesme: alan('sozlesme', 'Sözleşme / bütçe', sozlesme, input.sozlesmeKaynak ?? 'teklif'),
    onayliHakedis: alan('onayli', 'Onaylı hakediş', onayli ?? 0, 'onceki_hakedis'),
    buTalep: alan('talep', 'Bu talep', brut, onerilen != null ? (input.onerilenKaynak ?? 'metraj') : 'dosya'),
    kalanSozlesme: alan('kalan-sozlesme', 'Kalan bakiye', kalanSozlesme, 'onceki_hakedis'),
    toplamAvans: alan('avans', 'Toplam avans', avans ?? 0, 'avans'),
    kullanilanAvans: alan('kullanilan', 'Mahsup edilen avans', kullanilan ?? 0, 'avans'),
    kalanAvans: alan('kalan-avans', 'Kullanılabilir avans', kalanAvans ?? 0, 'avans'),
    onerilen: alan('onerilen', 'Önerilen tutar', onerilen, input.onerilenKaynak ?? 'metraj'),
    netOdenecek: net,
    uyarilar,
    eksikler,
  };
}

export function buildAvansIslemleri(rows: Array<{
  id: string;
  amount?: number;
  status?: string;
  note?: string | null;
  paymentDate?: string;
  referenceNo?: string | null;
}>): AvansIslem[] {
  return rows
    .filter((row) => isAvansPayment(row) && (row.status === 'pending' || row.status === 'completed'))
    .map((row) => {
      const odendi = row.status === 'completed';
      return {
        id: row.id,
        tarih: row.paymentDate,
        tip: odendi ? 'odeme' as const : 'talep' as const,
        tipLabel: odendi ? 'Avans ödemesi' : 'Avans talebi',
        tutar: roundTry(Number(row.amount ?? 0)),
        durum: odendi ? 'Ödendi' : 'Onay bekliyor',
        baglanti: row.referenceNo ?? undefined,
        kaynak: 'avans' as const,
      };
    });
}

export function buildAvansMahsupIslemleri(input: {
  payments?: Array<{
    id: string;
    amount?: number;
    method?: string | null;
    referenceNo?: string | null;
  }>;
  statements?: Array<{
    id: string;
    notes?: string | null;
    statementNo?: string;
  }>;
}): AvansIslem[] {
  const structural = (input.payments ?? [])
    .filter((row) => isHakedisMahsupPayment(row))
    .reduce<AvansIslem[]>((acc, row) => {
      const key = String(row.referenceNo ?? '').trim().toUpperCase();
      if (key && acc.some((item) => item.baglanti === key)) return acc;
      const tutar = roundTry(Number(row.amount ?? 0));
      if (tutar <= 0) return acc;
      acc.push({
        id: `mahsup-${row.id}`,
        tip: 'mahsup',
        tipLabel: 'Mahsup',
        tutar,
        durum: 'Mahsup edildi',
        baglanti: key || undefined,
        kaynak: 'onceki_hakedis',
      });
      return acc;
    }, []);
  if (structural.length > 0) return structural;
  return (input.statements ?? [])
    .map((row) => ({
      id: `mahsup-${row.id}`,
      tip: 'mahsup' as const,
      tipLabel: 'Mahsup',
      tutar: parseAvansMahsupFromNote(row.notes),
      durum: 'Mahsup edildi',
      baglanti: row.statementNo,
      kaynak: 'onceki_hakedis' as const,
    }))
    .filter((row) => row.tutar > 0);
}

function extractHakedisNo(raw?: string | null): string | undefined {
  const text = String(raw ?? '');
  const m = text.match(/\b(H-\d+|EKS-[\w-]+|VS-[\w-]+)\b/i);
  return m?.[1];
}

function sameMonth(iso?: string | null, ref = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function buildOdemePlani(input: {
  onayliHakedis?: number | null;
  payments: Array<{
    id: string;
    amount?: number;
    status?: string;
    note?: string | null;
    paymentDate?: string;
    dueDate?: string;
    referenceNo?: string | null;
    method?: string | null;
  }>;
  now?: Date;
}): OdemePlanOzet {
  const now = input.now ?? new Date();
  const hakedisOdemeleri = input.payments.filter((row) =>
    !isAvansPayment(row) && !isHakedisMahsupPayment(row),
  );
  const odenen = roundTry(hakedisOdemeleri
    .filter((row) => row.status === 'completed')
    .reduce((s, row) => s + Number(row.amount ?? 0), 0));
  const bekleyen = roundTry(hakedisOdemeleri
    .filter((row) => row.status === 'pending')
    .reduce((s, row) => s + Number(row.amount ?? 0), 0));
  const onaylanan = input.onayliHakedis != null ? roundTry(input.onayliHakedis) : null;
  const kalan = onaylanan == null ? null : roundTry(Math.max(0, onaylanan - odenen - bekleyen));
  const planlanan = roundTry(hakedisOdemeleri
    .filter((row) => row.status === 'pending')
    .reduce((s, row) => s + Number(row.amount ?? 0), 0));
  const buAy = roundTry(hakedisOdemeleri
    .filter((row) => row.status === 'pending' && (sameMonth(row.dueDate, now) || sameMonth(row.paymentDate, now)))
    .reduce((s, row) => s + Number(row.amount ?? 0), 0));
  const yaklasanRows = hakedisOdemeleri
    .filter((row) => row.status === 'pending')
    .sort((a, b) => {
      const da = new Date(a.dueDate ?? a.paymentDate ?? 0).getTime();
      const db = new Date(b.dueDate ?? b.paymentDate ?? 0).getTime();
      return da - db;
    });
  const yaklasan = roundTry(Number(yaklasanRows[0]?.amount ?? 0));

  const mapDurum = (status?: string) => {
    if (status === 'completed') return 'Ödendi';
    if (status === 'pending') return 'Planlandı';
    return status ?? '—';
  };

  return {
    onaylanan,
    odenen,
    bekleyen,
    kalan,
    planlanan,
    buAy,
    yaklasan,
    satirlar: [
      ...hakedisOdemeleri.map((row) => ({
        id: row.id,
        tarih: row.dueDate ?? row.paymentDate,
        vade: row.dueDate,
        tutar: roundTry(Number(row.amount ?? 0)),
        durum: mapDurum(row.status),
        baglanti: extractHakedisNo(row.referenceNo) ?? extractHakedisNo(row.note) ?? row.referenceNo ?? undefined,
        tip: 'hakedis' as const,
        tipLabel: 'Hakediş',
      })),
      ...input.payments.filter((row) => isAvansPayment(row)).map((row) => ({
        id: row.id,
        tarih: row.dueDate ?? row.paymentDate,
        vade: row.dueDate,
        tutar: roundTry(Number(row.amount ?? 0)),
        durum: mapDurum(row.status),
        baglanti: row.referenceNo ?? undefined,
        tip: 'avans' as const,
        tipLabel: 'Avans',
      })),
    ],
  };
}
