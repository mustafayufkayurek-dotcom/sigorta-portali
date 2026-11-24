import { toTitleCaseTR } from './text-helpers';

/**
 * Odaktan çıkınca Title Case (Mustafa Yufkayürek).
 * Değiştiyse personel uyarısı döner.
 */
export function applyVendorTitleCaseBlur(raw: string): {
  value: string;
  corrected: boolean;
  notice: string | null;
} {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return { value: '', corrected: false, notice: null };
  const value = toTitleCaseTR(collapsed);
  if (value === collapsed) return { value, corrected: false, notice: null };
  return {
    value,
    corrected: true,
    notice: `Yazım «${value}» biçimine çekildi`,
  };
}

/** Yazarken Title Case dışıysa anlık uyarı */
export function vendorWritingLiveHint(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  const expected = toTitleCaseTR(collapsed);
  if (expected === collapsed) return null;
  return `Kayıtta «${expected}» biçimine çekilir`;
}

/** Tek harf / kısaltma gibi eksik ad parçası */
export function isIncompleteNamePart(part: string): boolean {
  const t = part.replace(/\s+/g, ' ').trim();
  if (!t) return true;
  const letters = t.replace(/[^\p{L}]/gu, '');
  return letters.length < 2;
}

/**
 * Eksik yazımda onay metni. Yoksa null.
 * Örnek: Ad «M», soyad «Y.» veya hesap sahibi tek kelime.
 */
export function vendorIncompleteWritingConfirmMessage(opts: {
  entityType: 'individual' | 'corporate';
  firstName?: string;
  lastName?: string;
  name?: string;
  accountHolderName?: string;
}): string | null {
  const issues: string[] = [];
  if (opts.entityType === 'individual') {
    if (opts.firstName?.trim() && isIncompleteNamePart(opts.firstName)) {
      issues.push('Ad eksik görünüyor');
    }
    if (opts.lastName?.trim() && isIncompleteNamePart(opts.lastName)) {
      issues.push('Soyad eksik görünüyor');
    }
  } else if (opts.name?.trim()) {
    const tokens = opts.name.trim().split(/\s+/).filter(Boolean);
    if (tokens.some(isIncompleteNamePart) || opts.name.trim().replace(/[^\p{L}]/gu, '').length < 3) {
      issues.push('Ünvan eksik görünüyor');
    }
  }
  const holder = opts.accountHolderName?.trim();
  if (holder) {
    const tokens = holder.split(/\s+/).filter(Boolean);
    if (
      tokens.some(isIncompleteNamePart)
      || (opts.entityType === 'individual' && tokens.length < 2)
    ) {
      issues.push('Hesap sahibi adı eksik görünüyor');
    }
  }
  if (issues.length === 0) return null;
  return `${issues.join('. ')}. Devam ederseniz sonradan düzeltmeniz gerekir. Onaylıyor musunuz?`;
}
