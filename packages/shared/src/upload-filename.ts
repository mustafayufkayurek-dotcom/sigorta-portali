/**
 * Multer/Busboy multipart dosya adını UTF-8'e çeker.
 * Ham latin1 okuma «tedarikÃ§i kayÄ±t» gibi bozar.
 */
export function decodeMulterOriginalName(
  name: string | null | undefined,
): string {
  const raw = String(name ?? '').trim();
  if (!raw) return 'dosya';
  try {
    const asUtf8 = Buffer.from(raw, 'latin1').toString('utf8');
    if (
      asUtf8 &&
      !/\uFFFD/.test(asUtf8) &&
      Buffer.from(asUtf8, 'utf8').toString('latin1') === raw
    ) {
      return asUtf8;
    }
  } catch {
    /* ham ad kalsın */
  }
  return raw;
}

/** Ekranda eski bozulmuş kaydı da düzeltir (DB’ye yazmadan). */
export function displayUploadFilename(
  name: string | null | undefined,
): string {
  return decodeMulterOriginalName(name);
}
