/** Acil tespit / hizmet sonrası resmi — notes etiketine göre ayrılır. */

export const ACIL_INSPECTION_PHOTO_NOTE = 'Tespit Fotoğrafı';
export const ACIL_AFTER_SERVICE_PHOTO_NOTE = 'Hizmet Sonrası Resmi';

function foldNotes(notes?: string | null): string {
  return (notes ?? '').toLocaleLowerCase('tr-TR');
}

export function isAcilAfterServicePhotoNotes(notes?: string | null): boolean {
  const n = foldNotes(notes);
  return (
    n.includes('hizmet sonrası')
    || n.includes('hizmet sonrasi')
    || n.includes('kapanış')
    || n.includes('kapanis')
  );
}

/** Tespit kutusu kapanış resmini yutmaz. Eski notsuz yükleme tespit sayılır. */
export function isAcilInspectionPhotoNotes(notes?: string | null): boolean {
  if (isAcilAfterServicePhotoNotes(notes)) return false;
  const n = foldNotes(notes);
  if (!n.trim()) return true;
  return n.includes('tespit');
}
