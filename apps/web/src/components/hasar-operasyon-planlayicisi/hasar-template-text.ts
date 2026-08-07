/** Saf şablon metin yardımcıları — API/axios yok (regresyon testleri için). */

export type TemplateVars = {
  musteriAdi?: string;
  musteriTelefon?: string;
  dosyaNo?: string;
  sirketAdi?: string;
  sirketTelefon?: string;
  tedarikciAdi?: string;
  isTanimi?: string;
  hasarAdresi?: string;
  randevuTarih?: string;
  randevuSaat?: string;
  tahminiSure?: string;
};

export const INSPECTOR_APPOINTMENT_DEFAULT =
  '{dosyaNo} numaralı dosya için tespit randevusu: {randevuTarih} {randevuSaat}. Sigortalı: {musteriAdi}. Telefon: {musteriTelefon}. Adres: {hasarAdresi}. Tahmini süre: {tahminiSure}.';

export function interpolateHasarTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{musteriAdi\}/g, vars.musteriAdi ?? '')
    .replace(/\{musteriTelefon\}/g, vars.musteriTelefon ?? '')
    .replace(/\{dosyaNo\}/g, vars.dosyaNo ?? '')
    .replace(/\{sirketAdi\}/g, vars.sirketAdi ?? '')
    .replace(/\{sirketTelefon\}/g, vars.sirketTelefon ?? '')
    .replace(/\{tedarikciAdi\}/g, vars.tedarikciAdi ?? '')
    .replace(/\{isTanimi\}/g, vars.isTanimi ?? '')
    .replace(/\{hasarAdresi\}/g, vars.hasarAdresi ?? '')
    .replace(/\{randevuTarih\}/g, vars.randevuTarih ?? '')
    .replace(/\{randevuSaat\}/g, vars.randevuSaat ?? '')
    .replace(/\{tahminiSure\}/g, vars.tahminiSure ?? '');
}

/**
 * Eski DB şablonunda {musteriTelefon} yoksa tespitçi mesajına sigortalı telefonunu ekler.
 * Zaten varsa dokunmaz (çift yazım yok).
 */
export function ensureInsuredPhoneInMessage(message: string, phone: string): string {
  const p = (phone ?? '').trim();
  if (!p) return message;
  if (message.includes(p)) return message;
  const trimmed = message.replace(/\s+$/, '');
  const sep = trimmed.endsWith('.') ? '' : '.';
  return `${trimmed}${sep} Telefon: ${p}`;
}
