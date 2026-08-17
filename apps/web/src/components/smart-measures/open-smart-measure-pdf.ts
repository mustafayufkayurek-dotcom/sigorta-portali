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
  const url = URL.createObjectURL(pdfBlob);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  if (!isMobile) a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();

  if (!isMobile) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { ok: true };
}
