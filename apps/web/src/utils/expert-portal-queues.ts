/**
 * Eksper kuyruk sınıflandırması — portal durum etiketleriyle uyumlu.
 *
 * onay       = Onay / Revizyon Bekleniyor
 * rapor      = Rapor Yazılıyor / Rapor Bekleyen
 * onaylanan  = Onaylandı (onarım aşaması değil)
 * other      = Dosyalarım özeti (onarım / tespit / açık vb.)
 */
export type ExpertQueueKind = 'onay' | 'rapor' | 'onaylanan' | 'other';

/** Eski yer imleri: ?queue=inceleme → onay */
export function normalizeExpertQueueParam(
  queue: string | null | undefined,
): 'onay' | 'rapor' | 'onaylanan' | null {
  if (queue === 'onay' || queue === 'inceleme') return 'onay';
  if (queue === 'rapor') return 'rapor';
  if (queue === 'onaylanan' || queue === 'onaylandi') return 'onaylanan';
  return null;
}

export function classifyExpertQueue(
  statusName?: string | null,
  statusCode?: string | null,
): ExpertQueueKind {
  const s = (statusName ?? '').toLocaleLowerCase('tr-TR');
  const code = (statusCode ?? '').toLocaleLowerCase('tr-TR');
  if (!s && !code) return 'other';

  // Onarım / saha operasyonu → Dosyalarım (bu kuyruklara düşmez)
  if (
    code.startsWith('repair_') ||
    code === 'site_visit_planned' ||
    code === 'site_visit_done' ||
    (/onarım|onarim/.test(s) && !/rapor/.test(s))
  ) {
    return 'other';
  }

  // Onay / revizyon bekleyen
  if (
    /budget_submitted|budget_revision|pending_approval|awaiting_approval/.test(code) ||
    /onay bek|revizyon|bütçe sun|butce sun/.test(s)
  ) {
    return 'onay';
  }

  // Rapor yazılan / bekleyen — onarım değil
  if (
    code === 'budget_preparing' ||
    /rapor yaz|rapor bek/.test(s) ||
    (/rapor/.test(s) && !/onay|onarım|onarim/.test(s)) ||
    (/report/.test(code) && !/repair|approved/.test(code))
  ) {
    return 'rapor';
  }

  // Onaylanmış (onarım aşamasına geçen kodlar yukarıda elendi)
  if (
    code === 'budget_approved' ||
    code === 'report_approved' ||
    code === 'approved' ||
    (/onayland/.test(s) && !/beklen|revizyon|sunul/.test(s))
  ) {
    return 'onaylanan';
  }

  return 'other';
}

export function countExpertQueues(
  files: Array<{
    currentStatus?: { name?: string; code?: string } | null;
  }>,
): { onay: number; rapor: number; onaylanan: number; total: number } {
  let onay = 0;
  let rapor = 0;
  let onaylanan = 0;
  for (const f of files) {
    const kind = classifyExpertQueue(f.currentStatus?.name, f.currentStatus?.code);
    if (kind === 'onay') onay += 1;
    else if (kind === 'rapor') rapor += 1;
    else if (kind === 'onaylanan') onaylanan += 1;
  }
  return { onay, rapor, onaylanan, total: files.length };
}
