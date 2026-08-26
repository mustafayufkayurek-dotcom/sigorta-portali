/**
 * Hasar WhatsApp şablonları — Ayarlar › Mesaj Şablonları (Hasar sekmesi)
 * API: GET /notifications/sms/templates/:type
 * API yoksa / oturum yoksa Ayarlar’daki varsayılan metinler kullanılır (sahte başarı yok).
 */

import axios from 'axios';
import { SETTINGS_API, settingsAuthHeader } from '@/utils/settings-api';

export const HASAR_WA_TEMPLATE_TYPES = {
  insuredAppointment: 'whatsapp_hasar_randevu_sigortali',
  inspectorAppointment: 'whatsapp_hasar_randevu_tespitci',
  vendorAppointment: 'whatsapp_hasar_randevu_tedarikci',
  vendorAssignment: 'whatsapp_vendor_assignment',
  repairInsured: 'whatsapp_hasar_onarim_sigortali',
  repairVendor: 'whatsapp_hasar_onarim_tedarikci',
  closureSurvey: 'whatsapp_hasar_kapanis_anket',
} as const;

export type HasarWaTemplateType =
  (typeof HASAR_WA_TEMPLATE_TYPES)[keyof typeof HASAR_WA_TEMPLATE_TYPES];

export type HasarTemplateRecord = {
  type: string;
  name: string;
  content: string;
  isActive: boolean;
  source: 'ayarlar' | 'varsayilan';
};

const DEFAULTS: Record<string, { name: string; content: string }> = {
  [HASAR_WA_TEMPLATE_TYPES.insuredAppointment]: {
    name: 'Sigortalı Randevu Bilgilendirme',
    content:
      'Sayın {musteriAdi}, {dosyaNo} numaralı hasar dosyanız için tespit randevunuz {randevuTarih} günü saat {randevuSaat} olarak planlanmıştır. Adres: {hasarAdresi}. Tahmini süre: {tahminiSure}.',
  },
  [HASAR_WA_TEMPLATE_TYPES.inspectorAppointment]: {
    name: 'Tespitçi Randevu Bilgilendirme',
    content:
      '{dosyaNo} numaralı dosya için tespit randevusu: {randevuTarih} {randevuSaat}. Sigortalı: {musteriAdi}. Adres: {hasarAdresi}. Tahmini süre: {tahminiSure}.',
  },
  [HASAR_WA_TEMPLATE_TYPES.vendorAppointment]: {
    name: 'Tedarikçi Randevu Bilgilendirme',
    content:
      '{dosyaNo} numaralı dosya için hizmet randevusu: {randevuTarih} {randevuSaat}. İş: {isTanimi}. Adres: {hasarAdresi}. Tahmini süre: {tahminiSure}.',
  },
  [HASAR_WA_TEMPLATE_TYPES.vendorAssignment]: {
    name: 'Tedarikçi Atama WhatsApp Şablonu',
    content:
      'Meridyen Assistance — Tedarikçi Ataması\nDosya No: {dosyaNo}\nSigortalı: {musteriAdi}\nİş: {isTanimi}\nKonum: {hasarAdresi}\n\nLütfen dosyayı panelden kontrol ediniz.',
  },
  [HASAR_WA_TEMPLATE_TYPES.repairInsured]: {
    name: 'Onarım Randevusu — Sigortalı',
    content:
      'Sayın {musteriAdi}, {dosyaNo} numaralı dosyanız için onarım randevunuz {randevuTarih} günü saat {randevuSaat} olarak planlanmıştır. Adres: {hasarAdresi}.',
  },
  [HASAR_WA_TEMPLATE_TYPES.repairVendor]: {
    name: 'Onarım Randevusu — Tedarikçi',
    content:
      '{dosyaNo} numaralı dosya için onarım randevusu: {randevuTarih} {randevuSaat}. İş: {isTanimi}. Adres: {hasarAdresi}.',
  },
  [HASAR_WA_TEMPLATE_TYPES.closureSurvey]: {
    name: 'Hasar Kapanış Anketi',
    content:
      'Değerli {musteriAdi}, {dosyaNo} numaralı hasar dosyanız kapanışa hazırdır. Deneyiminizi değerlendirmenizi rica ederiz.',
  },
};

export type TemplateVars = {
  musteriAdi?: string;
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

export function interpolateHasarTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{musteriAdi\}/g, vars.musteriAdi ?? '')
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

function fallback(type: string): HasarTemplateRecord {
  const d = DEFAULTS[type] ?? {
    name: 'Mesaj Şablonu',
    content: '',
  };
  return {
    type,
    name: d.name,
    content: d.content,
    isActive: true,
    source: 'varsayilan',
  };
}

/** Ayarlar’dan çeker; başarısızsa varsayılan (Ayarlar ile aynı default metin). */
export async function loadHasarWaTemplates(): Promise<{
  templates: HasarTemplateRecord[];
  fromSettings: boolean;
}> {
  const types = Object.values(HASAR_WA_TEMPLATE_TYPES);
  try {
    const responses = await Promise.all(
      types.map((type) =>
        axios.get(`${SETTINGS_API}/notifications/sms/templates/${type}`, {
          headers: settingsAuthHeader(),
        }),
      ),
    );
    const templates = responses.map((res, i) => {
      const data = res.data as { type?: string; name?: string; content?: string; isActive?: boolean };
      return {
        type: data.type ?? types[i],
        name: data.name ?? DEFAULTS[types[i]]?.name ?? 'Mesaj Şablonu',
        content: data.content ?? DEFAULTS[types[i]]?.content ?? '',
        isActive: data.isActive !== false,
        source: 'ayarlar' as const,
      };
    });
    return { templates, fromSettings: true };
  } catch {
    return {
      templates: types.map((t) => fallback(t)),
      fromSettings: false,
    };
  }
}

export function pickTemplate(
  templates: HasarTemplateRecord[],
  type: string,
): HasarTemplateRecord {
  return templates.find((t) => t.type === type) ?? fallback(type);
}

/** Alıcı türüne göre Ayarlar şablon tipi */
export function templateTypeForRecipient(recipientType: string): HasarWaTemplateType {
  switch (recipientType) {
    case 'Tespitçi':
      return HASAR_WA_TEMPLATE_TYPES.inspectorAppointment;
    case 'Tedarikçi':
      return HASAR_WA_TEMPLATE_TYPES.vendorAssignment;
    case 'Eksper Ofisi':
    case 'Sigorta Şirketi':
      return HASAR_WA_TEMPLATE_TYPES.insuredAppointment;
    case 'Sigortalı':
    default:
      return HASAR_WA_TEMPLATE_TYPES.insuredAppointment;
  }
}
