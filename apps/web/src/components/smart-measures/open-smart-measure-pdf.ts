import { openSessionBlob } from '@/utils/pdf-preview-open';

/** Akıllı Ölçüm PDF blob açıcı — FieldSurvey’den bağımsız */

export async function openSmartMeasurePdfBlob(
  blob: Blob,
  filename: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (blob.size < 32) {
    return { ok: false, message: 'Pdf boş döndü.' };
  }

  const type = blob.type || '';
  if (type.includes('json') || type.includes('text/')) {
    try {
      const text = await blob.text();
      const parsed = JSON.parse(text) as { message?: string };
      return { ok: false, message: parsed.message || 'Pdf oluşturulamadı.' };
    } catch {
      return { ok: false, message: 'Pdf oluşturulamadı.' };
    }
  }

  const head = await blob.slice(0, 8).text();
  if (!head.startsWith('%PDF')) {
    try {
      const peek = await blob.slice(0, 800).text();
      if (peek.trim().startsWith('{')) {
        const parsed = JSON.parse(peek) as { message?: string };
        return { ok: false, message: parsed.message || 'Pdf oluşturulamadı.' };
      }
    } catch {
      /* */
    }
    return { ok: false, message: 'Sunucu Pdf yerine hata döndü.' };
  }

  const pdfBlob = new Blob([blob], { type: 'application/pdf' });
  const opened = await openSessionBlob(pdfBlob, filename.replace(/\.pdf$/i, '') || 'Ölçüm');
  if (!opened) return { ok: false, message: 'Pdf açılamadı.' };
  return { ok: true };
}
