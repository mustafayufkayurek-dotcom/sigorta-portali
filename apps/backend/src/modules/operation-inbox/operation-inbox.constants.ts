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

/** İlk senkron: son N gün (135k+ kutuda tam geçmiş çekilmez) */
export const SYNC_INITIAL_DAYS = 30;

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
