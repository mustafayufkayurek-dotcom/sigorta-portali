/** Acil Yardım tedarikçi hizmet alım sözleşmesi — Hasar onarım metninden ayrıdır. */

export const ACIL_VENDOR_SERVICE_CONTRACT_TITLE = 'Tedarikçi Hizmet Alım Sözleşmesi';
export const ACIL_VENDOR_SERVICE_CONTRACT_SUBTITLE = 'Acil Yardım — hizmet alımı';

export const ACIL_VENDOR_SERVICE_CONTRACT_CLAUSES: Array<{ title: string; body: string }> = [
  {
    title: 'Hizmetin konusu',
    body: 'Bu sözleşme, belirtilen adreste acil yardım hizmetinin tedarikçiden alınmasını kapsar. İş yerinde verilir.',
  },
  {
    title: 'Taraflar',
    body: 'Hizmeti alan taraf Meridyen Assistance’tır. Tedarikçi, dosyada yazılı kimliğiyle hizmeti verir. {{tedarikci_kimlik}}',
  },
  {
    title: 'Bedel',
    body: 'Hizmet bedeli dosyada yazılı tutardır: {{hizmet_bedeli}}. Ödeme, işin tamamlanması ve dosya kaydına göre yapılır.',
  },
  {
    title: 'Özen ve gizlilik',
    body: 'Tedarikçi işi özenle yapar. Hizmet sırasında öğrendiği kişi ve dosya bilgilerini üçüncü kişilere aktarmaz.',
  },
  {
    title: 'Onay',
    body: 'WhatsApp ile gönderilen onay sayfasındaki kabul, bu sözleşmenin bağlayıcı dijital onayıdır. {{imza_sure_gun}} gün içinde onaylanmazsa iş emri iptal edilebilir.',
  },
];

const FORBIDDEN_WORDS = ['hasar', 'onarım', 'tadilat', 'sigorta şirketi'] as const;

export function acilVendorServiceContractForbiddenHits(text: string): string[] {
  const lower = String(text ?? '').toLocaleLowerCase('tr-TR');
  return FORBIDDEN_WORDS.filter((word) => lower.includes(word));
}

export function acilVendorServiceContractTextIsClean(text: string): boolean {
  return acilVendorServiceContractForbiddenHits(text).length === 0;
}

export function renderAcilVendorServiceContractClauses(vars: {
  tedarikciKimlik: string;
  hizmetBedeli: string;
  imzaSureGun: string;
}): Array<{ title: string; body: string }> {
  const map: Record<string, string> = {
    '{{tedarikci_kimlik}}': vars.tedarikciKimlik,
    '{{hizmet_bedeli}}': vars.hizmetBedeli,
    '{{imza_sure_gun}}': vars.imzaSureGun,
  };
  return ACIL_VENDOR_SERVICE_CONTRACT_CLAUSES.map((clause) => {
    let body = clause.body;
    for (const [key, val] of Object.entries(map)) {
      body = body.replaceAll(key, val);
    }
    return { title: clause.title, body };
  });
}
