/** Hasar ön onay — söküm / enkaz gibi erken iş + ayrı dijital onay */

export const PRE_APPROVAL_DIGITAL_KIND = 'muvafakatname_on_is';
export const GENERAL_DIGITAL_KIND = 'muvafakatname';

export type PreApprovalJob = { id: string; name: string };

/** Ön onay listesinde her dosyada durur; işaretlenince yazı zorunlu. */
export const PRE_APPROVAL_OTHER_JOB_ID = 'diger';

export function isPreApprovalOtherJob(job: { id?: string | null } | null | undefined): boolean {
  return String(job?.id ?? '').trim().toLocaleLowerCase('tr-TR') === PRE_APPROVAL_OTHER_JOB_ID;
}

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
        if (!id) return null;
        if (!name && !isPreApprovalOtherJob({ id })) return null;
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

export function filePreApprovalItemChoices(
  items: Array<{ id?: string | null; jobDescription?: string | null; name?: string | null }>,
): PreApprovalJob[] {
  const seen = new Set<string>();
  const out: PreApprovalJob[] = [];
  for (const item of items) {
    const id = String(item.id ?? '').trim();
    const name = String(item.jobDescription ?? item.name ?? '').trim();
    if (!id || !name) continue;
    if (isPreApprovalOtherJob({ id })) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name });
  }
  return out;
}

export function preApprovalOtherTextOk(jobs: PreApprovalJob[]): boolean {
  const other = jobs.find((job) => isPreApprovalOtherJob(job));
  if (!other) return true;
  const text = String(other.name ?? '').trim();
  if (!text) return false;
  return text.toLocaleLowerCase('tr-TR') !== 'diğer';
}

export function preApprovalJobsSelectionOk(
  hasPre: boolean | null,
  jobs: PreApprovalJob[],
): boolean {
  if (hasPre !== true) return true;
  if (jobs.length === 0) return false;
  return preApprovalOtherTextOk(jobs);
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
  remainingRepairDropped?: boolean,
): number {
  if (remainingRepairDropped) return 0;
  if (isHasarDigitalApprovalRelaxed(insuredName)) return 0;
  if (hasPre === true && preApprovalJobsSelectionOk(true, jobs)) return 2;
  return 1;
}

export function isDigitalApprovalBundleReady(input: {
  hasPre: boolean | null;
  jobs: PreApprovalJob[];
  generalApproved: boolean;
  preApproved: boolean;
  insuredName?: unknown;
  remainingRepairDropped?: boolean;
}): boolean {
  if (input.remainingRepairDropped) return true;
  if (isHasarDigitalApprovalRelaxed(input.insuredName)) {
    return true;
  }
  if (input.hasPre === true) {
    if (!preApprovalJobsSelectionOk(true, input.jobs)) return false;
    return Boolean(input.generalApproved && input.preApproved);
  }
  return Boolean(input.generalApproved);
}

export function preApprovalDigitalLabel(): string {
  return 'Ön İş Dijital Onayı';
}

/** Müşteri belgesinde görünen iş adları. Boş ve tekrar düşer. */
export function preApprovalApprovalLines(jobs: PreApprovalJob[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const job of jobs) {
    const name = String(job.name ?? '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(name);
  }
  return lines;
}
