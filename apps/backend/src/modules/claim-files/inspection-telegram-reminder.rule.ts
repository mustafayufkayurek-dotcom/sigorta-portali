/**
 * Tespit uyarıları — Telegram grup mesajı (Sistem Alarmları formatı).
 * Dashboard amber band ile aynı sayım mantığı; kanal: grup özeti (günde 1).
 */

export type InspectionTelegramClaimRow = {
  fileNo?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  inspectionDone?: boolean | null;
};

export type InspectionTelegramDigest = {
  pendingCount: number;
  overdue48Count: number;
  sampleFileNos: string[];
};

export type InspectionTelegramPayload = {
  severity: 'WARNING' | 'INFO';
  code: string;
  title: string;
  detail: string;
  impact: string;
  action: string;
  text: string;
};

const MS_HOUR = 60 * 60 * 1000;
const SAMPLE_LIMIT = 5;

function toTime(iso: Date | string | null | undefined): number | null {
  if (!iso) return null;
  const t = iso instanceof Date ? iso.getTime() : new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Açık + tespit yapılmamış dosyalardan özet */
export function buildInspectionTelegramDigest(
  claims: InspectionTelegramClaimRow[],
  nowMs = Date.now(),
): InspectionTelegramDigest {
  let pendingCount = 0;
  let overdue48Count = 0;
  const sampleFileNos: string[] = [];

  for (const c of claims) {
    if (c.inspectionDone) continue;
    pendingCount += 1;
    const start = toTime(c.createdAt) ?? toTime(c.updatedAt);
    if (start != null && nowMs - start >= 48 * MS_HOUR) {
      overdue48Count += 1;
    }
    const no = (c.fileNo ?? '').trim();
    if (no && sampleFileNos.length < SAMPLE_LIMIT) {
      sampleFileNos.push(no);
    }
  }

  return { pendingCount, overdue48Count, sampleFileNos };
}

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Personel uyarıları için okunur TR tarih-saat */
export function formatInspectionTelegramTime(at: Date = new Date()): string {
  return at.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Sistem Alarmları gövdesi.
 * Personel tespit özeti: Kod/Sunucu yok; başlıklar HTML kalın; zaman TR okunur.
 */
export function formatMeridyenTelegramMessage(input: {
  severity: 'CRITICAL' | 'WARNING' | 'RECOVERY' | 'INFO';
  code: string;
  title: string;
  detail: string;
  impact: string;
  action: string;
  at?: Date;
  host?: string;
  /** Üst satır sağ etiket — varsayılan MERİDYEN CANLI */
  channelLabel?: string;
  /** Personel uyarılarında teknik Kod satırı gösterilmez */
  includeCode?: boolean;
  /** Personel uyarılarında Sunucu satırı gösterilmez */
  includeHost?: boolean;
  /** Personel onay özeti: Etki satırı yok */
  includeImpact?: boolean;
  /** Durum satırı — onay özetinde Konu yeterince netse kapatılır */
  includeDetail?: boolean;
  /** Başlık etiketlerini kalın yap (HTML) */
  boldLabels?: boolean;
  /** ops = teknik ISO; human = 11 Ağustos 2026 09:00 */
  timeStyle?: 'ops' | 'human';
}): string {
  const prefix =
    input.severity === 'CRITICAL'
      ? '🔴 KRİTİK'
      : input.severity === 'WARNING'
        ? '🟠 UYARI'
        : input.severity === 'RECOVERY'
          ? '🟢 DÜZELDİ'
          : '🔵 BİLGİ';
  const at = input.at ?? new Date();
  const ts =
    input.timeStyle === 'human'
      ? formatInspectionTelegramTime(at)
      : at
          .toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul', hour12: false })
          .replace('T', ' ')
        + ' +0300';
  const host = (input.host ?? 'meridyen').trim() || 'meridyen';
  const channelLabel = (input.channelLabel ?? 'MERİDYEN CANLI').trim() || 'MERİDYEN CANLI';
  const includeCode = input.includeCode !== false;
  const includeHost = input.includeHost !== false;
  const includeImpact = input.includeImpact !== false;
  const includeDetail = input.includeDetail !== false;
  const bold = input.boldLabels === true;
  const label = (name: string) => (bold ? `<b>${name}</b>` : name);
  const v = (text: string) => (bold ? escapeTelegramHtml(text) : text);

  const titleText = input.title ?? '';
  const konuLine = titleText.includes('\n')
    ? `${label('Konu')}:\n${v(titleText)}`
    : `${label('Konu')}: ${v(titleText)}`;

  const lines = [`${prefix} | ${channelLabel}`, konuLine];
  if (includeCode) {
    lines.push(`${label('Kod')}: ${v(input.code)}`);
  }
  if (includeImpact) {
    lines.push(`${label('Etki')}: ${v(input.impact)}`);
  }
  if (includeDetail) {
    lines.push(`${label('Durum')}: ${v(input.detail)}`);
  }
  lines.push(`${label('Aksiyon')}: ${v(input.action)}`, `${label('Zaman')}: ${v(ts)}`);
  if (includeHost) {
    lines.push(`${label('Sunucu')}: ${v(host)}`);
  }
  return lines.join('\n');
}

export function buildInspectionTelegramPayload(
  digest: InspectionTelegramDigest,
  opts?: { at?: Date; host?: string },
): InspectionTelegramPayload | null {
  if (digest.pendingCount <= 0) return null;

  const severity: 'WARNING' | 'INFO' = digest.overdue48Count > 0 ? 'WARNING' : 'INFO';
  const code = digest.overdue48Count > 0 ? 'INSPECTION_OVERDUE_48H' : 'INSPECTION_PENDING';
  const title =
    digest.overdue48Count > 0
      ? 'Saha Tespiti Gecikti — Aksiyon Gerekli'
      : 'Saha Tespiti Bekleniyor';

  const base =
    digest.pendingCount === 1
      ? '1 dosyada tespit henüz yapılmadı'
      : `${digest.pendingCount} dosyada tespit henüz yapılmadı`;
  const late =
    digest.overdue48Count > 0
      ? digest.overdue48Count === 1
        ? ' · 1 dosya 48 saati aştı'
        : ` · ${digest.overdue48Count} dosya 48 saati aştı`
      : '';
  const samples =
    digest.sampleFileNos.length > 0
      ? ` Örnek: ${digest.sampleFileNos.join(', ')}`
      : '';
  const detail = `${base}${late}.${samples}`;

  const impact =
    'Saha tespiti tamamlanmayan dosyalarda operasyon ve dosya sorumlusu akışı aksayabilir.';
  const action =
    'Saha Merkezi ve Dosya Sorumlusu Merkezi tespit uyarı bandını kontrol edin; tespiti tamamlayın.';

  const text = formatMeridyenTelegramMessage({
    severity,
    code,
    title,
    detail,
    impact,
    action,
    at: opts?.at,
    host: opts?.host,
    channelLabel: 'SAHA TESPİT',
    includeCode: false,
    includeHost: false,
    boldLabels: true,
    timeStyle: 'human',
  });

  return { severity, code, title, detail, impact, action, text };
}
