export const INBOUND_INGEST_QUEUE = 'inbound-ingest';
export const INBOUND_CLASSIFY_QUEUE = 'inbound-classify';

export const M365_GRAPH_CONFIG_KEY = 'm365_graph_config';

export const SHARED_MAILBOXES = {
  IHBAR: 'ihbar@safranbh.com',
  HASAR: 'hasar@safranbh.com',
} as const;

/** Graph delta poll state — graph_subscriptions.subscription_id prefix */
export const DELTA_POLL_SUBSCRIPTION_PREFIX = 'delta-poll-';

/** Graph change notification abonelikleri delta-poll kayıtlarından ayrı tutulur */
export const WEBHOOK_SUBSCRIPTION_PREFIX = 'webhook-notify-';

/** İlk senkron: son N gün (delta link sıfırlandığında yedek pencere) */
export const SYNC_INITIAL_DAYS = 30;

/**
 * Canlı kullanım başlangıcı — bu tarihten önceki mailler çekilmez / saklanmaz.
 * 1 Temmuz 2026 00:00 Europe/Istanbul = 2026-06-30T21:00:00.000Z
 */
export const INBOUND_SYNC_CUTOFF_ISO = '2026-06-30T21:00:00.000Z';
export const INBOUND_SYNC_CUTOFF = new Date(INBOUND_SYNC_CUTOFF_ISO);

export function isInboundBeforeSyncCutoff(receivedAt: Date | string): boolean {
  const at = receivedAt instanceof Date ? receivedAt : new Date(receivedAt);
  return at.getTime() < INBOUND_SYNC_CUTOFF.getTime();
}

/** Graph delta ilk URL filtresi — kesim ile rolling pencereden geç olanı kullan */
export function inboundSyncFilterCutoff(): Date {
  const rolling = new Date();
  rolling.setDate(rolling.getDate() - SYNC_INITIAL_DAYS);
  return rolling.getTime() > INBOUND_SYNC_CUTOFF.getTime() ? rolling : INBOUND_SYNC_CUTOFF;
}

/** Delta sayfa boyutu (Graph $top) */
export const SYNC_PAGE_SIZE = 50;

/** Tek sync job’unda en fazla sayfa (timeout önlemi) */
export const SYNC_MAX_PAGES_PER_JOB = 10;

export const GRAPH_MESSAGE_SELECT =
  'id,internetMessageId,conversationId,subject,bodyPreview,body,from,toRecipients,receivedDateTime,hasAttachments';

export const INGEST_JOB_SYNC_MAILBOX = 'sync-mailbox';
export const CLASSIFY_JOB_MESSAGE = 'classify-message';

export interface SyncMailboxJobData {
  mailbox: 'IHBAR' | 'HASAR';
  /** Graph @odata.nextLink — aynı sync turunda devam */
  nextLink?: string;
  /** Job içi sayfa sayacı */
  pageCount?: number;
}

export const SYNC_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 15_000 },
  removeOnComplete: true,
  removeOnFail: false,
};

export const CLASSIFY_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: 'exponential' as const, delay: 10_000 },
  removeOnComplete: true,
  removeOnFail: false,
};
