/**
 * Dijital onay WhatsApp metni — sigortalıya şüpheli işlem kalıbı olmasın.
 * Link durur; kim, dosya, neden ve dosya sorumlusu cep yazılır.
 */

export type DijitalOnayWhatsAppKind = 'hasar' | 'acil_ihbar' | 'acil_kapanis';

export function dijitalOnayWhatsAppKind(documentKind: string): DijitalOnayWhatsAppKind {
  if (documentKind === 'adres_hizmet_talep') return 'acil_ihbar';
  if (documentKind === 'matbu_evrak') return 'acil_kapanis';
  return 'hasar';
}

/** WhatsApp’ta tıklanır TR cep: 532 133 4144 */
export function formatDijitalOnayOwnerPhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  let local = digits;
  if (local.startsWith('90') && local.length >= 12) local = local.slice(2);
  if (local.startsWith('0')) local = local.slice(1);
  if (/^5\d{9}$/.test(local)) {
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  const trimmed = String(raw ?? '').trim();
  return trimmed || null;
}

export function buildDijitalOnayWhatsAppMessage(input: {
  kind: DijitalOnayWhatsAppKind;
  insuredName?: string | null;
  fileNo?: string | null;
  approvalUrl: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
}): string {
  const insured = String(input.insuredName ?? '').trim() || 'ilgili';
  const fileNo = String(input.fileNo ?? '').trim() || '—';
  const url = String(input.approvalUrl ?? '').trim();
  const owner = String(input.ownerName ?? '').trim();
  const ownerPhone = formatDijitalOnayOwnerPhone(input.ownerPhone);

  let purpose: string;
  if (input.kind === 'acil_ihbar') {
    purpose =
      `Meridyen Assistance, ${fileNo} numaralı acil yardım dosyanız için belirtilen adreste hizmet verilmesini için onayınız gerekmektedir. Söz konusu talep olağan prosedür kapsamındadır.`;
  } else if (input.kind === 'acil_kapanis') {
    purpose =
      `Meridyen Assistance, ${fileNo} numaralı acil yardım dosyanızda hizmetin tamamlandığını onaylamanız gerekmektedir.`;
  } else {
    purpose =
      `Meridyen Assistance, ${fileNo} numaralı hasar dosyanız için onarım onayı gerekmektedir. Söz konusu talep olağan prosedür kapsamındadır.`;
  }

  const ownerLine = owner
    ? `Bu yazı dosya sorumlusu ${owner} tarafından gönderilmiştir.`
    : 'Bu yazı dosya sorumlusu tarafından gönderilmiştir.';

  const lines = [
    `Sayın ${insured},`,
    '',
    purpose,
    '',
    'Onay sayfası (meridyen-tr.com):',
    url,
    '',
    ownerLine,
    'Meridyen Assistance',
  ];
  if (ownerPhone) {
    lines.push(`Dosya sorumlusu cep: ${ownerPhone}`);
  }
  return lines.join('\n');
}
