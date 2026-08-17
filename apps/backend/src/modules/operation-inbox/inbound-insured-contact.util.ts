import { isCorporateInboxSender } from './inbound-sender-profile';

/**
 * Gelen kutusunda sigortalı e-postası — gönderen (ekspertiz/asistan) adresi asla kullanılmaz.
 * AI / form çıkarımı veya kullanıcının açıkça girdiği değer geçerlidir.
 */
export function resolveInsuredEmailForInbox(params: {
  explicitEmail?: string | null;
  extractedEmail?: string | null;
  fromAddress?: string | null;
}): string | undefined {
  const explicit = params.explicitEmail?.trim();
  if (explicit) return explicit;

  const extracted = params.extractedEmail?.trim();
  if (extracted && !isCorporateInboxSender(extracted)) return extracted;

  return undefined;
}

/** Kurumsal müşteri e-postası sigortalı birey oluşturmayı engellememeli — e-postasız devam. */
export function shouldCreateInsuredWithoutEmailOnDuplicate(params: {
  field?: string | null;
  entityType?: string | null;
  creatingEntityType?: string | null;
}): boolean {
  if (params.creatingEntityType !== 'individual') return false;
  if (params.field !== 'email') return false;
  return params.entityType === 'corporate';
}
