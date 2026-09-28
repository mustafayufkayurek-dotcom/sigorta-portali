/** Yönetici sabah bakışı — sıfır satır basılmaz; yeni tema / KPI duvarı değildir. */

import { EXPERT_SILENCE_CRM_HREF } from '@sigorta/shared';

export type MorningBriefingItem = {
  id: 'sessiz' | 'tahsilat' | 'onay72' | 'puantaj' | 'kutu';
  href: string;
  label: string;
  value: string;
  ariaLabel: string;
  preview?: 'onay72';
};

export type MorningBriefingCountUnit = 'Dosya' | 'Kişi' | 'Yazı' | 'İş';

export type MorningBriefingClaimPreview = {
  id: string;
  href: string;
  fileNo: string;
  insured: string;
  statusLabel: string;
  party: string;
  place: string;
  reportId: string | null;
  customerEmail: string;
  insuranceEmail: string;
};

export const MORNING_BRIEFING_HREF = {
  sessiz: EXPERT_SILENCE_CRM_HREF,
  tahsilat: '/panel/finans/tahsilatlar',
  onay72: '/panel/hasar-dosyalari',
  puantaj: '/panel/personel-ozluk?tab=attendance',
  kutu: '/panel/operasyon/gelen-kutusu',
} as const;

function count(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(Number(n))) return 0;
  return Math.max(0, Math.floor(Number(n)));
}

export function formatMorningBriefingMoney(amount: number): string {
  return `${Number(amount).toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} TL`;
}

export function formatMorningBriefingCount(n: number, unit: MorningBriefingCountUnit): string {
  return `${n} ${unit}`;
}

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nestedTrim(obj: unknown, key: string): string {
  if (!obj || typeof obj !== 'object') return '';
  return trimStr((obj as Record<string, unknown>)[key]);
}

function previewReportId(row: Record<string, unknown>): string | null {
  const latest = row.latestRepairReport;
  const fromLatest = nestedTrim(latest, 'id');
  if (fromLatest) return fromLatest;
  const reports = row.repairReports;
  if (!Array.isArray(reports) || reports.length === 0) return null;
  const first = reports[0];
  const id = nestedTrim(first, 'id');
  return id || null;
}

function previewParty(row: Record<string, unknown>): string {
  const customer = row.customer;
  return (
    nestedTrim(customer, 'shortName') ||
    nestedTrim(customer, 'companyName') ||
    nestedTrim(customer, 'fullName') ||
    nestedTrim(row.insuranceCompany, 'name')
  );
}

function previewPlace(row: Record<string, unknown>): string {
  const address = row.propertyAddress;
  const district = nestedTrim(address, 'district');
  const city = nestedTrim(address, 'city');
  if (district && city) return `${district} · ${city}`;
  return district || city || nestedTrim(row.claimSubject, 'name') || nestedTrim(row.departmentFileSubject, 'name');
}

export type MorningBriefingHoverLine = {
  key: string;
  title: string;
  detail?: string;
  href?: string;
};

export const MORNING_BRIEFING_HOVER_LIMIT = 5;

export function mapMorningBriefingHoverLines(
  id: MorningBriefingItem['id'],
  source: {
    silent?: Array<{ ownerName?: string | null; headline?: string | null }>;
    payments?: Array<{ fileNo?: string | null; amount?: number | null; insuranceCompany?: string | null }>;
    claims?: Array<Pick<MorningBriefingClaimPreview, 'id' | 'href' | 'fileNo' | 'insured' | 'statusLabel'>>;
    employees?: Array<{ fullName?: string | null; status?: string | null }>;
    inbox?: Array<{
      id?: string;
      subject?: string | null;
      fromName?: string | null;
      fromAddress?: string | null;
      isUnowned?: boolean;
    }>;
  },
): MorningBriefingHoverLine[] {
  if (id === 'sessiz') {
    return (source.silent ?? [])
      .map((row, index) => {
        const title = String(row.ownerName ?? '').trim();
        const detail = String(row.headline ?? '').trim();
        if (!title && !detail) return null;
        return {
          key: `sessiz-${index}-${title}`,
          title: title || 'Dosya Sorumlusu',
          detail: detail || undefined,
          href: MORNING_BRIEFING_HREF.sessiz,
        };
      })
      .filter((row): row is MorningBriefingHoverLine => Boolean(row))
      .slice(0, MORNING_BRIEFING_HOVER_LIMIT);
  }

  if (id === 'tahsilat') {
    return (source.payments ?? [])
      .map((row, index) => {
        const title = String(row.fileNo ?? '').trim();
        if (!title) return null;
        const amount = Number(row.amount);
        const party = String(row.insuranceCompany ?? '').trim();
        const money = Number.isFinite(amount) && amount > 0 ? formatMorningBriefingMoney(amount) : '';
        return {
          key: `tahsilat-${index}-${title}`,
          title,
          detail: [party, money].filter(Boolean).join(' · ') || undefined,
          href: MORNING_BRIEFING_HREF.tahsilat,
        };
      })
      .filter((row): row is MorningBriefingHoverLine => Boolean(row))
      .slice(0, MORNING_BRIEFING_HOVER_LIMIT);
  }

  if (id === 'onay72') {
    return (source.claims ?? []).slice(0, MORNING_BRIEFING_HOVER_LIMIT).map((row) => ({
      key: `onay72-${row.id}`,
      title: row.fileNo,
      detail: [row.insured, row.statusLabel].filter((part) => part && part !== '—').join(' · ') || undefined,
      href: row.href,
    }));
  }

  if (id === 'puantaj') {
    return (source.employees ?? [])
      .filter((row) => row.status === 'missing')
      .map((row, index) => {
        const title = String(row.fullName ?? '').trim();
        if (!title) return null;
        return {
          key: `puantaj-${index}-${title}`,
          title,
          detail: 'Onaylanmadı',
          href: MORNING_BRIEFING_HREF.puantaj,
        };
      })
      .filter((row): row is MorningBriefingHoverLine => Boolean(row))
      .slice(0, MORNING_BRIEFING_HOVER_LIMIT);
  }

  return (source.inbox ?? [])
    .filter((row) => row.isUnowned === true)
    .map((row, index) => {
      const title = String(row.subject ?? '').trim() || 'Konusuz yazı';
      const from = String(row.fromName ?? row.fromAddress ?? '').trim();
      return {
        key: `kutu-${row.id ?? index}`,
        title,
        detail: from || undefined,
        href: MORNING_BRIEFING_HREF.kutu,
      };
    })
    .slice(0, MORNING_BRIEFING_HOVER_LIMIT);
}

export function mapMorningBriefingClaimPreview(raw: unknown): MorningBriefingClaimPreview[] {
  const list = Array.isArray(raw) ? raw : [];
  const rows: MorningBriefingClaimPreview[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = trimStr(row.id);
    const fileNo = trimStr(row.fileNo) || trimStr(row.claimNo);
    if (!id && !fileNo) continue;
    const href = id
      ? `/panel/hasar-dosyalari/${encodeURIComponent(id)}?grup=operasyon`
      : `/panel/hasar-dosyalari?search=${encodeURIComponent(fileNo)}`;
    const status = row.currentStatus as { code?: string; name?: string } | null | undefined;
    const operationLabel = trimStr(row.operationStatusLabel);
    const statusName = typeof status?.name === 'string' ? status.name.trim() : '';
    rows.push({
      id: id || fileNo,
      href,
      fileNo: fileNo || '—',
      insured: trimStr(row.insuredName) || '—',
      statusLabel: operationLabel || statusName || '—',
      party: previewParty(row),
      place: previewPlace(row),
      reportId: previewReportId(row),
      customerEmail: nestedTrim(row.customer, 'email'),
      insuranceEmail: nestedTrim(row.insuranceCompany, 'contactEmail'),
    });
  }
  return rows;
}

export function buildMorningBriefingItems(input: {
  silentOwnerCount?: number | null;
  pendingIncomingCount?: number | null;
  totalPendingAmount?: number | null;
  approval72h?: number | null;
  attendanceNotApproved?: number | null;
  inboxUnowned?: number | null;
}): MorningBriefingItem[] {
  const items: MorningBriefingItem[] = [];
  const silent = count(input.silentOwnerCount);
  if (silent > 0) {
    const value = formatMorningBriefingCount(silent, 'Kişi');
    items.push({
      id: 'sessiz',
      href: MORNING_BRIEFING_HREF.sessiz,
      label: 'Sessiz Müşteri',
      value,
      ariaLabel: `Sessiz Müşteri, ${value}`,
    });
  }

  const incoming = count(input.pendingIncomingCount);
  const money = Number(input.totalPendingAmount);
  const moneyOk = Number.isFinite(money) && money > 0;

  if (incoming > 0 || moneyOk) {
    const value = moneyOk
      ? incoming > 0
        ? `${formatMorningBriefingCount(incoming, 'İş')} · ${formatMorningBriefingMoney(money)}`
        : formatMorningBriefingMoney(money)
      : formatMorningBriefingCount(incoming, 'İş');
    items.push({
      id: 'tahsilat',
      href: MORNING_BRIEFING_HREF.tahsilat,
      label: 'Bekleyen Tahsilat',
      value,
      ariaLabel: `Bekleyen Tahsilat, ${value}`,
    });
  }

  const h72 = count(input.approval72h);
  if (h72 > 0) {
    const value = formatMorningBriefingCount(h72, 'Dosya');
    items.push({
      id: 'onay72',
      href: MORNING_BRIEFING_HREF.onay72,
      label: 'Onay 72 Saat',
      value,
      ariaLabel: `Onay 72 Saat, ${value}`,
      preview: 'onay72',
    });
  }

  const attendance = count(input.attendanceNotApproved);
  if (attendance > 0) {
    const value = formatMorningBriefingCount(attendance, 'Kişi');
    items.push({
      id: 'puantaj',
      href: MORNING_BRIEFING_HREF.puantaj,
      label: 'Puantaj Onaylanmadı',
      value,
      ariaLabel: `Puantaj Onaylanmadı, ${value}`,
    });
  }

  const unowned = count(input.inboxUnowned);
  if (unowned > 0) {
    const value = formatMorningBriefingCount(unowned, 'Yazı');
    items.push({
      id: 'kutu',
      href: MORNING_BRIEFING_HREF.kutu,
      label: 'Dosyası Olmayan Mail',
      value,
      ariaLabel: `Dosyası Olmayan Mail, ${value}`,
    });
  }

  return items;
}
