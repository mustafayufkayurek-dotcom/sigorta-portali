'use client';

/**
 * Masraf belge / dosya hakediş kontrol penceresi.
 * Benzer belge no kırmızı şeritte kilitlemez: pop-up’ta mevcut kayıtlar görülür,
 * karşı seçenekler (Vazgeç / Belge No Değiştir / Mevcut Aç) veya devam.
 */
import {
  EXPENSE_DOCUMENT_CONTINUE_REASON,
  type ExpenseDocumentDuplicateRow,
  type ExpenseDocumentReviewPayload,
  type ExpenseFileHakedisWarning,
} from '@sigorta/shared';
import { FinansActionButton, FinansModal } from '@/components/finance/FinansPanelUI';
import { formatTryAmount } from '@/utils/format-try-amount';
import { isoToTrDateDisplay } from '@/utils/tr-date-input';

export type ExpenseDocumentReviewModalProps = {
  open: boolean;
  review: ExpenseDocumentReviewPayload | null;
  saving?: boolean;
  onCancel: () => void;
  /** Belge no alanına dön; yeni numara yazılsın. */
  onEditDocumentNo: () => void;
  onOpenExisting: (expenseId: string) => void;
  onContinueWithReason: (reason: string) => void;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  return isoToTrDateDisplay(d) || d;
}

function HakedisRow({ row }: { row: ExpenseFileHakedisWarning }) {
  const kindLabel = row.kind === 'acil' ? 'Acil Yardım' : 'Hasar Onarım';
  const paidLabel =
    row.paid === true ? 'Ödendi' : row.paid === false ? 'Ödenmedi' : 'Ödeme kaydı yok';
  return (
    <li
      className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-slate-800"
      data-testid="masraf-hakedis-uyari-satir"
    >
      <div className="font-medium text-amber-900">
        {kindLabel} · {row.fileNo}
      </div>
      <div className="mt-0.5 text-slate-600">
        {row.vendorName} · {formatTryAmount(row.amount)} · {paidLabel}
        {row.grantedAt ? ` · ${formatDate(row.grantedAt)}` : ''}
      </div>
    </li>
  );
}

function DuplicateRow({
  row,
  onOpen,
}: {
  row: ExpenseDocumentDuplicateRow;
  onOpen: () => void;
}) {
  return (
    <li
      className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
      data-testid="masraf-belge-cakisma-satir"
    >
      <div className="min-w-0">
        <div className="font-medium text-slate-800">
          {row.receiptDocumentType || 'Belge'} · No {row.receiptDocumentNo || '—'}
        </div>
        <div className="mt-0.5 text-slate-500">
          {formatDate(row.date)} · {formatTryAmount(row.amount)}
          {row.operationNo ? ` · ${row.operationNo}` : ''}
        </div>
        {(row.fileNo || row.customerName) && (
          <div className="mt-0.5 truncate text-slate-500">
            {[row.fileNo, row.customerName].filter(Boolean).join(' · ')}
          </div>
        )}
        {row.description ? (
          <div className="mt-0.5 truncate text-slate-400">{row.description}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
        data-testid="masraf-belge-mevcut-ac"
      >
        Kaydı Aç
      </button>
    </li>
  );
}

export function ExpenseDocumentReviewModal({
  open,
  review,
  saving,
  onCancel,
  onEditDocumentNo,
  onOpenExisting,
  onContinueWithReason,
}: ExpenseDocumentReviewModalProps) {
  if (!open || !review) return null;

  const duplicates = review.documentDuplicates ?? [];
  const hakedis = review.hakedisWarnings ?? [];
  const firstDupId = duplicates[0]?.id;
  const hasDocs = duplicates.length > 0;

  return (
    <FinansModal
      open={open}
      title="Belge Kontrolü"
      subtitle="Önce listedeki kayıtları kontrol edin. Aynı fiş değilse devam edebilirsiniz."
      size="lg"
      testId="masraf-belge-kontrol-pencere"
      footer={(
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-slate-500 sm:text-right">
            Karşı seçenekler: vazgeçin, belge numarasını değiştirin veya mevcut kaydı açın.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <FinansActionButton
              label="Vazgeç"
              variant="neutral"
              showPlus={false}
              onClick={onCancel}
              disabled={saving}
              testId="masraf-belge-iptal"
            />
            <FinansActionButton
              label="Fiş No'yu Değiştir"
              variant="neutral"
              showPlus={false}
              onClick={onEditDocumentNo}
              disabled={saving}
              testId="masraf-fis-no-degistir"
            />
            {firstDupId ? (
              <FinansActionButton
                label="Mevcut Kaydı Aç"
                variant="neutral"
                showPlus={false}
                onClick={() => onOpenExisting(firstDupId)}
                disabled={saving}
                testId="masraf-belge-mevcut-kayit"
              />
            ) : null}
            <FinansActionButton
              label={saving ? 'Kaydediliyor…' : 'Kaydetmeye Devam Et'}
              variant="primary"
              showPlus={false}
              onClick={() => onContinueWithReason(EXPENSE_DOCUMENT_CONTINUE_REASON)}
              disabled={saving}
              testId="masraf-belge-farkli-kaydet"
            />
          </div>
        </div>
      )}
    >
      <div className="space-y-4" data-testid="masraf-belge-kontrol-govde">
        <p className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
          {review.message}
        </p>

        {hasDocs ? (
          <section>
            <h4 className="mb-2 text-xs font-semibold text-slate-700">
              Aynı Veya Benzer Belge No · {duplicates.length} Kayıt
            </h4>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {duplicates.map((row) => (
                <DuplicateRow key={row.id} row={row} onOpen={() => onOpenExisting(row.id)} />
              ))}
            </ul>
          </section>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Benzer belge uyarısı geldi. Mevcut satır listesi bu yanıtta yoksa önce belge numarasını
            değiştirin; aynı fiş olduğundan eminseniz kaydetmeye devam edin.
          </p>
        )}

        {hakedis.length > 0 ? (
          <section>
            <h4 className="mb-2 text-xs font-semibold text-slate-700">
              Dosya Hakediş Uyarısı (Hasar / Acil)
            </h4>
            <ul className="space-y-2">
              {hakedis.map((row) => (
                <HakedisRow key={`${row.kind}-${row.fileId}-${row.grantedAt ?? ''}`} row={row} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </FinansModal>
  );
}

export function looksLikeBelgeConflictMessage(raw: unknown): boolean {
  const text = String(raw ?? '');
  return /belge no|benzer belge|aynı veya benzer belge|belge kontrol/i.test(text);
}

/** 409 gövdesinden kontrol penceresi; eski düz metin uyarısı da pop-up’a açılır. */
export function parseExpenseDocumentReviewFromError(err: unknown): ExpenseDocumentReviewPayload | null {
  if (!err || typeof err !== 'object') return null;
  const ax = err as {
    response?: { status?: number; data?: unknown };
  };
  if (ax.response?.status !== 409) return null;
  const data = ax.response.data;
  if (!data || typeof data !== 'object') {
    if (typeof data === 'string' && looksLikeBelgeConflictMessage(data)) {
      return {
        code: 'EXPENSE_DOCUMENT_REVIEW',
        message: data,
        documentDuplicates: [],
        hakedisWarnings: [],
        requiresOverride: true,
      };
    }
    return null;
  }
  const body = data as Record<string, unknown>;
  const nested = body.message;
  const payload =
    nested && typeof nested === 'object'
      ? (nested as Record<string, unknown>)
      : body;
  if (payload.code === 'EXPENSE_DOCUMENT_REVIEW') {
    return payload as unknown as ExpenseDocumentReviewPayload;
  }
  const text =
    typeof nested === 'string'
      ? nested
      : typeof body.message === 'string'
        ? body.message
        : '';
  if (looksLikeBelgeConflictMessage(text) || looksLikeBelgeConflictMessage(body.error)) {
    return {
      code: 'EXPENSE_DOCUMENT_REVIEW',
      message: text || String(body.error ?? 'Benzer belge no bulundu. Kontrol penceresinden devam edin.'),
      documentDuplicates: Array.isArray((body as { documentDuplicates?: unknown }).documentDuplicates)
        ? ((body as { documentDuplicates: ExpenseDocumentDuplicateRow[] }).documentDuplicates)
        : [],
      hakedisWarnings: Array.isArray((body as { hakedisWarnings?: unknown }).hakedisWarnings)
        ? ((body as { hakedisWarnings: ExpenseFileHakedisWarning[] }).hakedisWarnings)
        : [],
      requiresOverride: true,
    };
  }
  return null;
}
