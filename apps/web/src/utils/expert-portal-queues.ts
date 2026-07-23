/**
 * Eksper kuyruk sınıflandırması — dosya durum adından (gerçek API metni).
 * Sahte sayım üretmez; eşleşmeyenler other kalır.
 */
export type ExpertQueueKind = 'inceleme' | 'rapor' | 'other';

export function classifyExpertQueue(statusName?: string | null): ExpertQueueKind {
  const s = (statusName ?? '').toLocaleLowerCase('tr-TR');
  if (!s) return 'other';
  if (/incele|keşif|kesif|tespit|saha|ekspertiz/.test(s)) return 'inceleme';
  if (/rapor|onarım|onarim/.test(s)) return 'rapor';
  return 'other';
}

export function countExpertQueues(
  files: Array<{ currentStatus?: { name?: string } | null }>,
): { inceleme: number; rapor: number } {
  let inceleme = 0;
  let rapor = 0;
  for (const f of files) {
    const kind = classifyExpertQueue(f.currentStatus?.name);
    if (kind === 'inceleme') inceleme += 1;
    else if (kind === 'rapor') rapor += 1;
  }
  return { inceleme, rapor };
}
