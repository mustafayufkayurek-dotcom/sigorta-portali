/** Finans Merkezi kart adresi → Tahsilatlar / Ödemeler kuyruk sekmesi. */

export type FinansTahsilatQueueTab = 'all' | 'collection' | 'payable' | 'completed' | 'due';

const QUEUE_TABS: FinansTahsilatQueueTab[] = ['all', 'collection', 'payable', 'completed', 'due'];

export function queueTabFromFinanceSearch(input: {
  queue?: string | null;
  paymentType?: string | null;
  status?: string | null;
  dueOverdue?: string | null;
}): FinansTahsilatQueueTab {
  const queue = String(input.queue ?? '').trim() as FinansTahsilatQueueTab;
  if (QUEUE_TABS.includes(queue)) return queue;

  const type = String(input.paymentType ?? '').trim();
  const status = String(input.status ?? '').trim();
  if (input.dueOverdue === 'true' || status === 'due') return 'due';
  if (type === 'incoming' && status === 'pending') return 'collection';
  if (type === 'outgoing' && status === 'pending') return 'payable';
  if (status === 'completed') return 'completed';
  if (type === 'incoming') return 'collection';
  if (type === 'outgoing') return 'payable';
  return 'all';
}
