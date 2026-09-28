/**
 * Eksper sessizliği: onay kuyruğu değil; 2 gündür hasar ihbarı gelmeyişi.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/crm-expert-silence.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EXPERT_SILENCE_DAYS,
  EXPERT_SILENCE_FOLLOW_UP_TITLE,
  EXPERT_SILENCE_STRIP_CTA,
  EXPERT_SILENCE_STRIP_HINT,
  evaluateExpertWork,
  expertNewRegionMailDraft,
  expertSilenceFileStillMissing,
  expertSilenceIstanbulYmd,
  expertSilenceMailDraft,
  expertSilenceOwnerHeadline,
  expertSilencePostponeDueAt,
  expertSilenceStripHint,
  isExpertSilenceFollowUpTitle,
  isIstanbulCity,
  pickExpertSilenceAlternatives,
} from './crm-expert-silence.ts';

const now = new Date('2026-09-27T12:00:00.000Z');

describe('CRM eksper sessizlik kilidi', () => {
  it('hiç dosya yoksa sessiz denmez; yeni bölgedir', () => {
    const work = evaluateExpertWork({ fileCount: 0, openFileCount: 0, now });
    assert.equal(work.kind, 'no_work');
    assert.equal(work.lane, 'new_region');
    assert.equal(work.silent, false);
  });

  it('açık veya onay bekleyen dosya sessizliği kapatmaz', () => {
    const work = evaluateExpertWork({
      fileCount: 2,
      openFileCount: 1,
      lastFileAt: '2026-07-01T00:00:00.000Z',
      now,
    });
    assert.equal(work.kind, 'silent');
    assert.equal(work.silent, true);
  });

  it('son onay taze olsa bile 2 gündür ihbar yoksa sessizdir', () => {
    const work = evaluateExpertWork({
      fileCount: 3,
      openFileCount: 1,
      lastFileAt: '2026-09-25T00:00:00.000Z',
      lastApprovedAt: '2026-09-26T00:00:00.000Z',
      now,
    });
    assert.equal(work.kind, 'silent');
    assert.equal(work.silent, true);
    assert.equal(work.silentDays != null && work.silentDays >= EXPERT_SILENCE_DAYS, true);
    assert.equal(work.followUpTitle, EXPERT_SILENCE_FOLLOW_UP_TITLE);
  });

  it('2 gündür yeni dosya yoksa sessizdir', () => {
    const work = evaluateExpertWork({
      fileCount: 3,
      openFileCount: 0,
      lastFileAt: '2026-09-25T00:00:00.000Z',
      now,
    });
    assert.equal(work.kind, 'silent');
    assert.equal(work.silent, true);
  });

  it('son hasar dosyası 2 günden yeniyse aktiftir', () => {
    const work = evaluateExpertWork({
      fileCount: 1,
      openFileCount: 1,
      lastFileAt: '2026-09-26T00:00:00.000Z',
      now,
    });
    assert.equal(work.silent, false);
    assert.equal(work.kind, 'open_file');
  });

  it('takip başlığı, 2 gün kuralı ve İstanbul ayrımı durur', () => {
    assert.equal(EXPERT_SILENCE_DAYS, 2);
    assert.equal(EXPERT_SILENCE_STRIP_CTA, 'Sessiz Müşteri Uyarı -> Tıklayınız');
    assert.match(EXPERT_SILENCE_STRIP_HINT, /Dosya Akış Hızı Düşmüş/);
    assert.match(EXPERT_SILENCE_STRIP_HINT, /Mevcut ve Alternatif Müşteri Görüşmelerine Başlayınız/);
    assert.equal(
      expertSilenceOwnerHeadline({
        acted: true,
        dismissed: false,
        opened: true,
        customers: [{ name: 'Ada Eksper', action: 'Arandı', note: 'Sonraki dosyayı konuştuk.' }],
      }),
      'Ada Eksper: Arandı — Sonraki dosyayı konuştuk.',
    );
    assert.equal(
      expertSilenceOwnerHeadline({
        acted: true,
        dismissed: false,
        opened: true,
        customers: [{ name: 'Ada Eksper', action: 'Arandı', note: 'Sonraki dosyayı konuştuk.', fileStillMissing: true }],
      }),
      'Ada Eksper: Arandı — Konuşuldu, dosya gelmedi.',
    );
    assert.equal(
      expertSilenceFileStillMissing({
        actedAt: '2026-09-24T12:00:00.000Z',
        lastFileAt: '2026-09-20T00:00:00.000Z',
        now,
      }),
      true,
    );
    assert.equal(
      expertSilenceFileStillMissing({
        actedAt: '2026-09-26T12:00:00.000Z',
        lastFileAt: '2026-09-20T00:00:00.000Z',
        now,
      }),
      false,
    );
    assert.equal(
      pickExpertSilenceAlternatives(
        [
          { id: 'a', kind: 'customer', lane: 'new_region' },
          { id: 'b', kind: 'customer', lane: 'new_region' },
          { id: 'c', kind: 'customer', lane: 'new_region' },
          { id: 'd', kind: 'customer', lane: 'new_region' },
          { id: 's', kind: 'customer', lane: 'silent' },
        ],
        ['s'],
      ).map((row) => row.id).join(','),
      'a,b,c',
    );
    assert.match(expertSilenceIstanbulYmd(now), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(isExpertSilenceFollowUpTitle('Bu ofisten iş gelmedi.'), true);
    assert.equal(isExpertSilenceFollowUpTitle('Onay bekliyor'), false);
    assert.equal(isIstanbulCity('İstanbul'), true);
    assert.equal(isIstanbulCity('Ankara'), false);
    assert.match(expertSilenceMailDraft('Ada Eksper').message, /yeni iş gelmedi/);
    assert.equal(expertSilenceStripHint(), EXPERT_SILENCE_STRIP_HINT);
    assert.match(expertNewRegionMailDraft('Ada Eksper').message, /Ortak bir iş/);
    assert.equal(expertSilencePostponeDueAt(now).startsWith('2026-09-29'), true);
  });
});
