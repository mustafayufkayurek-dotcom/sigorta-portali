/** Eksper ofisi: son gönderilen hasar dosyası. Onay kuyruğu değildir. Mail otomatik gitmez. */

export const EXPERT_SILENCE_DAYS = 2;
export const EXPERT_SILENCE_FOLLOW_UP_TITLE = 'Bu ofisten iş gelmedi.';
export const EXPERT_SILENCE_CRM_HREF = '/panel/crm?lane=silent&kind=customer';
export const EXPERT_SILENCE_STRIP_TITLE = 'Sessiz Müşteri Uyarı';
export const EXPERT_SILENCE_STRIP_CLICK = 'Tıklayınız';
export const EXPERT_SILENCE_STRIP_CTA = `${EXPERT_SILENCE_STRIP_TITLE} -> ${EXPERT_SILENCE_STRIP_CLICK}`;
export const EXPERT_SILENCE_STRIP_HINT =
  'Dosya Akış Hızı Düşmüş Olup, Mevcut ve Alternatif Müşteri Görüşmelerine Başlayınız';
export const EXPERT_SILENCE_DISMISS_ACTION = 'crm.silence.dismissed';
export const EXPERT_SILENCE_OPENED_ACTION = 'crm.silence.opened';
export const EXPERT_SILENCE_SIGNAL_KEY = 'silence-warning';
export const EXPERT_OPEN_FILE_OWNER_LINE =
  'Bu ofiste açık dosya var. Onay bekleyen iş dosya kartındadır.';

export function expertSilenceStripHint() {
  return EXPERT_SILENCE_STRIP_HINT;
}

export type ExpertSilenceKind = 'no_work' | 'open_file' | 'active' | 'silent';
export type ExpertLane = 'silent' | 'new_region' | 'open_file' | 'active';

export type ExpertWorkInput = {
  fileCount: number;
  openFileCount: number;
  lastFileAt?: string | Date | null;
  lastApprovedAt?: string | Date | null;
  now?: Date;
};

export type ExpertWorkMemory = {
  kind: ExpertSilenceKind;
  lane: ExpertLane;
  silent: boolean;
  fileCount: number;
  openFileCount: number;
  lastFileAt: string | null;
  lastApprovedAt: string | null;
  lastWorkAt: string | null;
  silentDays: number | null;
  followUpTitle: string;
};

const DAY_MS = 1000 * 60 * 60 * 24;

function toTime(value?: string | Date | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function toIso(value?: string | Date | null): string | null {
  const time = toTime(value);
  return time == null ? null : new Date(time).toISOString();
}

export function isExpertSilenceFollowUpTitle(title?: string | null) {
  return String(title ?? '').trim() === EXPERT_SILENCE_FOLLOW_UP_TITLE;
}

export function isIstanbulCity(city?: string | null) {
  const value = String(city ?? '').trim().toLocaleLowerCase('tr-TR');
  return value.includes('istanbul') || value.includes('ıstanbul');
}

export function expertLaneOf(kind: ExpertSilenceKind): ExpertLane {
  if (kind === 'silent') return 'silent';
  if (kind === 'no_work') return 'new_region';
  if (kind === 'open_file') return 'open_file';
  return 'active';
}

export function evaluateExpertWork(input: ExpertWorkInput): ExpertWorkMemory {
  const fileCount = Math.max(0, Number(input.fileCount ?? 0) || 0);
  const openFileCount = Math.max(0, Number(input.openFileCount ?? 0) || 0);
  const lastFileAt = toIso(input.lastFileAt);
  const lastApprovedAt = toIso(input.lastApprovedAt);
  const lastFileTime = toTime(lastFileAt);
  const lastApprovedTime = toTime(lastApprovedAt);
  const lastWorkTime =
    lastFileTime == null
      ? lastApprovedTime
      : lastApprovedTime == null
        ? lastFileTime
        : Math.max(lastFileTime, lastApprovedTime);
  const now = (input.now ?? new Date()).getTime();
  const silentDays = lastFileTime == null ? null : Math.max(0, Math.floor((now - lastFileTime) / DAY_MS));

  let kind: ExpertSilenceKind = 'active';
  if (fileCount === 0) kind = 'no_work';
  else if (silentDays != null && silentDays >= EXPERT_SILENCE_DAYS) kind = 'silent';
  else if (openFileCount > 0) kind = 'open_file';

  return {
    kind,
    lane: expertLaneOf(kind),
    silent: kind === 'silent',
    fileCount,
    openFileCount,
    lastFileAt,
    lastApprovedAt,
    lastWorkAt: lastWorkTime == null ? null : new Date(lastWorkTime).toISOString(),
    silentDays,
    followUpTitle: EXPERT_SILENCE_FOLLOW_UP_TITLE,
  };
}

export function expertSilencePostponeDueAt(now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + EXPERT_SILENCE_DAYS);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function expertSilenceMailDraft(officeName: string) {
  const name = String(officeName ?? '').trim() || 'Eksper ofisi';
  return {
    subject: `${name} - Sonraki dosya`,
    message: 'Merhaba,\n\nSon çalıştığımız dosyadan bu yana yeni iş gelmedi. Sonraki dosyada buradayız.\n',
  };
}

export function expertNewRegionMailDraft(officeName: string) {
  const name = String(officeName ?? '').trim() || 'Eksper ofisi';
  return {
    subject: `${name} - Bölge`,
    message: 'Merhaba,\n\nBölgede dosya yürüttüğümüzde buradayız. Ortak bir iş olursa yazabilirsiniz.\n',
  };
}

export const EXPERT_SILENCE_ALTERNATIVE_LIMIT = 3;
export const EXPERT_SILENCE_NO_FILE_LINE = 'Konuşuldu, dosya gelmedi.';

export type ExpertSilenceCustomerAct = {
  name: string;
  action: string;
  note?: string | null;
  fileStillMissing?: boolean;
};

export type ExpertSilenceAltInput = {
  id: string;
  kind?: string;
  lane?: string | null;
};

export function expertSilenceIstanbulYmd(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now);
}

export function expertSilenceDismissStorageKey(now = new Date()) {
  return `hasar-sessiz-uyari-kapat:${expertSilenceIstanbulYmd(now)}`;
}

export function expertSilenceFileStillMissing(input: {
  actedAt?: string | Date | null;
  lastFileAt?: string | Date | null;
  now?: Date;
}) {
  const acted = toTime(input.actedAt);
  if (acted == null) return false;
  const lastFile = toTime(input.lastFileAt);
  if (lastFile != null && lastFile >= acted) return false;
  const now = (input.now ?? new Date()).getTime();
  return now - acted >= EXPERT_SILENCE_DAYS * DAY_MS;
}

export function pickExpertSilenceAlternatives(
  rows: ExpertSilenceAltInput[],
  silentIds: string[],
  limit = EXPERT_SILENCE_ALTERNATIVE_LIMIT,
) {
  const skip = new Set(silentIds.map((id) => String(id).trim()).filter(Boolean));
  const cap = Math.max(0, Number(limit) || 0);
  return rows
    .filter((row) => {
      if (!row?.id || skip.has(row.id)) return false;
      if (row.kind && row.kind !== 'customer') return false;
      return row.lane === 'new_region';
    })
    .slice(0, cap);
}

export function expertSilenceOwnerHeadline(input: {
  acted: boolean;
  dismissed: boolean;
  opened: boolean;
  customers: ExpertSilenceCustomerAct[];
}) {
  if (input.acted && input.customers.length > 0) {
    return input.customers
      .slice(0, 4)
      .map((row) => {
        const action = String(row.action ?? '').trim() || 'İşlem';
        if (row.fileStillMissing) return `${row.name}: ${action} — ${EXPERT_SILENCE_NO_FILE_LINE}`;
        const note = String(row.note ?? '').trim();
        return note ? `${row.name}: ${action} — ${note}` : `${row.name}: ${action}`;
      })
      .join('. ');
  }
  if (input.acted) return 'CRM’de işlem yaptı.';
  if (input.dismissed) return 'Uyarıyı kapattı. CRM işlemi yok.';
  if (input.opened) return 'CRM’i açtı. Henüz not yok.';
  return 'Uyarıya bakmadı.';
}

export function evaluateAssistanceWork(input: ExpertWorkInput): ExpertWorkMemory {
  return {
    ...evaluateExpertWork(input),
    followUpTitle: 'Bu müşteriden ihbar gelmedi.',
  };
}
