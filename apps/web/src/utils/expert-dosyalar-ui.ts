/** Dosyalarım (D3XX) — SLA / durum görsel yardımcıları */

export type ExpertSlaTone = 'green' | 'amber' | 'red' | 'muted';

export type ExpertSlaBadge = {
  text: string;
  tone: ExpertSlaTone;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** SLA bitişine göre gecikmiş gün sayısı (gecikme yoksa 0; tarih yoksa null). */
export function expertDelayDays(input: {
  slaDueAt?: string | null;
  delayRisk?: boolean;
}): number | null {
  if (!input.slaDueAt) {
    return input.delayRisk ? null : 0;
  }
  const due = new Date(input.slaDueAt).getTime();
  if (Number.isNaN(due)) return null;
  const overdue = Math.ceil((Date.now() - due) / DAY_MS);
  if (overdue > 0 || input.delayRisk) {
    return Math.max(overdue, input.delayRisk ? 1 : overdue);
  }
  return 0;
}

export function expertSlaBadge(input: {
  slaDueAt?: string | null;
  delayRisk?: boolean;
  statusName?: string | null;
}): ExpertSlaBadge {
  const status = (input.statusName ?? '').toLocaleLowerCase('tr-TR');
  if (/tamam|kapandı|kapan|bitti|sonuç/.test(status)) {
    return { text: 'Tamamlandı', tone: 'green' };
  }
  if (!input.slaDueAt) {
    return { text: '—', tone: 'muted' };
  }
  const due = new Date(input.slaDueAt).getTime();
  if (Number.isNaN(due)) return { text: '—', tone: 'muted' };
  const days = Math.ceil((due - Date.now()) / DAY_MS);
  if (days < 0 || input.delayRisk) {
    return { text: 'Süre Aşımı', tone: 'red' };
  }
  return { text: `${days} Gün Kaldı`, tone: days <= 2 ? 'amber' : 'green' };
}

export function expertSlaBadgeClass(tone: ExpertSlaTone): string {
  const base = 'inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap';
  if (tone === 'green') return `${base} text-emerald-700`;
  if (tone === 'amber') return `${base} text-amber-700`;
  if (tone === 'red') return `${base} text-red-700`;
  return `${base} text-slate-400`;
}

export function expertSlaDotClass(tone: ExpertSlaTone): string {
  if (tone === 'green') return 'bg-status-success';
  if (tone === 'amber') return 'bg-amber-400';
  if (tone === 'red') return 'bg-status-danger';
  return 'bg-slate-300';
}

/** Referans durum badge renkleri */
export function expertStatusBadgeClass(statusName?: string | null): string {
  const s = (statusName ?? '').toLocaleLowerCase('tr-TR');
  const base =
    'inline-flex h-[23px] max-w-[10rem] items-center truncate rounded-full px-2.5 text-[11.5px] font-semibold leading-none';
  if (/hazır|hazir/.test(s)) return `${base} bg-sky-100 text-sky-800`;
  if (/tamam|kapandı|kapan|bitti|sonuç/.test(s)) return `${base} bg-[#E4F3EA] text-[#166B3F]`;
  if (/onay/.test(s)) return `${base} bg-[#F1E9FC] text-[#7C3AED]`;
  if (/rapor/.test(s)) return `${base} bg-[#FBE4E1] text-[#C0392B]`;
  if (/incele|keşif|kesif|tespit|saha|ekspertiz/.test(s)) return `${base} bg-[#FEF3C7] text-[#B45309]`;
  return `${base} bg-slate-100 text-slate-700`;
}
