/**
 * Kapanış e-postası PDF iskeleti — Helvetica (ASCII).
 * Nihai rapor görünümü sonraki turda sıkılaşır; ek boş gitmez.
 */

function pdfEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function toPdfAscii(text: string): string {
  return text
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 'S')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'G')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'O')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'C')
    .replace(/ç/g, 'c')
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim();
}

export function buildAcilClosureReportPdf(input: {
  fileNo: string;
  insured: string;
  subject: string;
  ihbarAt: string;
  workStartedAt: string;
  serviceDeliveredAt: string;
  closedAt: string;
  summary: string;
}): Buffer {
  const lines = [
    'Meridyen Assistance — Kapanis Raporu',
    '',
    `Dosya No: ${toPdfAscii(input.fileNo)}`,
    `Sigortali: ${toPdfAscii(input.insured)}`,
    `Konu: ${toPdfAscii(input.subject)}`,
    `Ihbar tarihi: ${toPdfAscii(input.ihbarAt)}`,
    `Ise baslama: ${toPdfAscii(input.workStartedAt)}`,
    `Hizmet verilme: ${toPdfAscii(input.serviceDeliveredAt)}`,
    `Kapanis tarihi: ${toPdfAscii(input.closedAt)}`,
    `Islem ozeti: ${toPdfAscii(input.summary)}`,
  ];
  const contentParts = ['BT', '/F1 12 Tf', '50 800 Td', '16 TL'];
  for (const line of lines) {
    contentParts.push(`(${pdfEscape(line || ' ')}) Tj`, 'T*');
  }
  contentParts.push('ET');
  const stream = contentParts.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(body, 'utf8');
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `${xref}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body, 'utf8');
}
