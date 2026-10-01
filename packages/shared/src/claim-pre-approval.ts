/** Hasar ön onay — söküm / enkaz gibi erken iş + ayrı dijital onay */

export const PRE_APPROVAL_DIGITAL_KIND = 'muvafakatname_on_is';
export const GENERAL_DIGITAL_KIND = 'muvafakatname';

export type PreApprovalJob = { id: string; name: string };

export function parseHasPreApprovalWork(raw: unknown): boolean | null {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  return null;
}

export function parsePreApprovalJobs(raw: unknown): PreApprovalJob[] {
  if (Array.isArray(raw)) {
    return raw
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const id = String((row as { id?: unknown }).id ?? '').trim();
        const name = String((row as { name?: unknown }).name ?? '').trim();
        if (!id || !name) return null;
        return { id, name };
      })
      .filter((row): row is PreApprovalJob => Boolean(row));
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parsePreApprovalJobs(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

/** Yalnız Ali Rıza Özcan: onarımdan çekildi; sigortalı dijital onayı istenmez. */
export const RELAXED_DIGITAL_APPROVAL_INSURED = 'ali rıza özcan';

export function foldInsuredName(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR');
}

export function isHasarDigitalApprovalRelaxed(insuredName: unknown): boolean {
  return foldInsuredName(insuredName) === RELAXED_DIGITAL_APPROVAL_INSURED;
}

export function expectedDigitalApprovalCount(
  hasPre: boolean | null,
  jobs: PreApprovalJob[],
  insuredName?: unknown,
): number {
  if (isHasarDigitalApprovalRelaxed(insuredName)) return 0;
  if (hasPre === true && jobs.length > 0) return 2;
  return 1;
}

export function isDigitalApprovalBundleReady(input: {
  hasPre: boolean | null;
  jobs: PreApprovalJob[];
  generalApproved: boolean;
  preApproved: boolean;
  insuredName?: unknown;
}): boolean {
  if (isHasarDigitalApprovalRelaxed(input.insuredName)) {
    return true;
  }
  if (input.hasPre === true) {
    if (input.jobs.length === 0) return false;
    return Boolean(input.generalApproved && input.preApproved);
  }
  return Boolean(input.generalApproved);
}

export function preApprovalDigitalLabel(): string {
  return 'Ön İş Dijital Onayı';
}
