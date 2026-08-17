/**
 * Asistans Firma Portalı — Acil Yardım aşama sınıflandırması.
 * Hasar (ClaimFile) akışından bağımsız; EmergencyStatus üzerinden.
 */

export type AssistanceStage =
  | 'yeni_ihbar'
  | 'sahada'
  | 'onay_bekleyen'
  | 'onaylanan'
  | 'other';

export type AssistanceStageCounts = {
  yeniIhbar: number;
  sahada: number;
  onayBekleyen: number;
  onaylanan: number;
};

export type AssistanceCaseLike = {
  id: string;
  currentStatus?: { code?: string | null; name?: string | null } | null;
  /** enrichCase: satış (gelir) toplamı — fiyat girilmişse onay bekliyor kabul edilir */
  totalGelir?: number | null;
  status?: string | null;
};

export const ASSISTANCE_STAGE_LABELS: Record<Exclude<AssistanceStage, 'other'>, string> = {
  yeni_ihbar: 'Yeni İhbar',
  sahada: 'Sahada',
  onay_bekleyen: 'Onay Bekleyen',
  onaylanan: 'Onaylanan',
};

export const EMERGENCY_STATUS_LABELS: Record<string, string> = {
  GELEN: 'İhbar',
  ATANDI: 'Tedarikçi Atandı',
  SAHADA: 'Saha',
  COZULDU: 'Dosya Kapatıldı',
  FATURALANDILDI: 'Finansa Aktarıldı',
};

export function normalizeEmergencyStatus(raw?: string | null): string {
  return String(raw ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR');
}

export function emergencyStatusLabel(raw?: string | null): string {
  const code = normalizeEmergencyStatus(raw);
  return EMERGENCY_STATUS_LABELS[code] ?? (raw?.trim() || '—');
}

/**
 * Exclusive buckets:
 * - Yeni İhbar: GELEN
 * - Sahada: ATANDI, veya SAHADA ve henüz satış bedeli yok
 * - Onay Bekleyen: SAHADA ve satış bedeli girilmiş (onay / kapanış öncesi)
 * - Onaylanan: COZULDU, FATURALANDILDI
 */
export function classifyAssistanceStage(file: AssistanceCaseLike): AssistanceStage {
  const code = normalizeEmergencyStatus(file.currentStatus?.code ?? file.status);
  if (code === 'GELEN') return 'yeni_ihbar';
  if (code === 'COZULDU' || code === 'FATURALANDILDI') return 'onaylanan';
  if (code === 'ATANDI') return 'sahada';
  if (code === 'SAHADA') {
    const gelir = typeof file.totalGelir === 'number' ? file.totalGelir : 0;
    return gelir > 0 ? 'onay_bekleyen' : 'sahada';
  }
  return 'other';
}

export function countAssistanceStages(files: AssistanceCaseLike[]): AssistanceStageCounts {
  const counts: AssistanceStageCounts = {
    yeniIhbar: 0,
    sahada: 0,
    onayBekleyen: 0,
    onaylanan: 0,
  };
  for (const file of files) {
    const stage = classifyAssistanceStage(file);
    if (stage === 'yeni_ihbar') counts.yeniIhbar += 1;
    else if (stage === 'sahada') counts.sahada += 1;
    else if (stage === 'onay_bekleyen') counts.onayBekleyen += 1;
    else if (stage === 'onaylanan') counts.onaylanan += 1;
  }
  return counts;
}

export function parseAssistanceStageParam(raw: string | null): AssistanceStage | 'all' {
  if (!raw) return 'all';
  const v = raw.trim().toLocaleLowerCase('tr-TR');
  if (v === 'yeni' || v === 'yeni_ihbar' || v === 'ihbar') return 'yeni_ihbar';
  if (v === 'sahada' || v === 'saha') return 'sahada';
  if (v === 'onay_bekleyen' || v === 'onay-bekleyen' || v === 'pending') return 'onay_bekleyen';
  if (v === 'onaylanan' || v === 'approved') return 'onaylanan';
  return 'all';
}
