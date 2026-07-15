import { formatActivityAction } from './format-activity-action';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(formatActivityAction('status_change') === 'Durum Değişti', 'status_change map');
assert(formatActivityAction('STATUS_CHANGED') === 'Durum Değişti', 'STATUS_CHANGED map');
assert(formatActivityAction('assignment') === 'Atama', 'assignment map');
assert(formatActivityAction('file_updated') === 'İşlem güncellendi', 'unknown snake → fallback');
assert(formatActivityAction('weird_event_xyz') === 'İşlem güncellendi', 'unknown snake 2');
assert(formatActivityAction('Onay Bekliyor') === 'Onay Bekliyor', 'passthrough TR');
assert(formatActivityAction(null) === 'İşlem güncellendi', 'null fallback');
assert(formatActivityAction(undefined) === 'İşlem güncellendi', 'undefined fallback');
assert(formatActivityAction('') === 'İşlem güncellendi', 'empty fallback');

console.log('format-activity-action.test.ts PASS');
