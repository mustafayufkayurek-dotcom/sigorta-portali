'use client';

/**
 * Masraf belge / dosya hakediş kontrol penceresi.
 * Belge çakışması veya Hasar/Acil hakediş uyarısında kayıt yazılmaz; personel seçer.
 */
import { useState } from 'react';
import {
  EXPENSE_DOCUMENT_OVERRIDE_REASON_MIN,
  isValidExpenseDocumentOverrideReason,
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
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 text-xs font-medium text-brand-700 hover:underline"
        data-testid="masraf-belge-mevcut-ac"
      >
        Aç
      </button>
    </li>
  );
}

export function ExpenseDocumentReviewModal({
  open,
  review,
  saving,
  onCancel,
  onOpenExisting,
  onContinueWithReason,
}: ExpenseDocumentReviewModalProps) {
  const [reason, setReason] = useState('');
  const [showContinue, setShowContinue] = useState(false);
  const [localError, setLocalError] = useState('');

  if (!open || !review) return null;

  const duplicates = review.documentDuplicates ?? [];
  const hakedis = review.hakedisWarnings ?? [];
  const firstDupId = duplicates[0]?.id;

  const submitContinue = () => {
    setLocalError('');
    if (!isValidExpenseDocumentOverrideReason(reason)) {
      setLocalError(
        `Gerekçe en az ${EXPENSE_DOCUMENT_OVERRIDE_REASON_MIN} karakter olmalıdır.`,
      );
      return;
    }
    onContinueWithReason(reason.trim());
  };

  return (
    <FinansModal
      open={open}
      title="Belge Ve Hakediş Kontrolü"
      subtitle={review.message}
      size="lg"
      testId="masraf-belge-kontrol-pencere"
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <FinansActionButton
            label="Kaydı İptal Et"
            variant="neutral"
            showPlus={false}
            onClick={onCancel}
            disabled={saving}
            testId="masraf-belge-iptal"
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
          {!showContinue ? (
            <FinansActionButton
              label="Farklı Belge — Devam"
              variant="primary"
              showPlus={false}
              onClick={() => setShowContinue(true)}
              disabled={saving}
              testId="masraf-belge-farkli-ac"
            />
          ) : (
            <FinansActionButton
              label={saving ? 'Kaydediliyor…' : 'Gerekçe İle Kaydet'}
              variant="primary"
              showPlus={false}
              onClick={submitContinue}
              disabled={saving}
              testId="masraf-belge-farkli-kaydet"
            />
          )}
        </div>
      )}
    >
      <div className="space-y-4" data-testid="masraf-belge-kontrol-govde">
        {duplicates.length > 0 ? (
          <section>
            <h4 className="mb-2 text-xs font-semibold text-slate-700">Eşleşen Masraflar</h4>
            <ul className="space-y-2">
              {duplicates.map((row) => (
                <DuplicateRow key={row.id} row={row} onOpen={() => onOpenExisting(row.id)} />
              ))}
            </ul>
          </section>
        ) : null}

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

        {showContinue ? (
          <div className="space-y-1.5" data-testid="masraf-belge-gerekce">
            <label htmlFor="masraf-belge-gerekce-input" className="text-xs font-medium text-slate-600">
              Neden farklı belge?
            </label>
            <textarea
              id="masraf-belge-gerekce-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              placeholder="Örn. farklı dönem faturası, yeni iş kalemi"
              data-testid="masraf-belge-gerekce-input"
            />
            {localError ? (
              <p className="text-xs text-red-600" role="alert">{localError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </FinansModal>
  );
}

export function parseExpenseDocumentReviewFromError(err: unknown): ExpenseDocumentReviewPayload | null {
  if (!err || typeof err !== 'object') return null;
  const ax = err as {
    response?: { status?: number; data?: unknown };
  };
  if (ax.response?.status !== 409) return null;
  const data = ax.response.data;
  if (!data || typeof data !== 'object') return null;
  const body = data as Record<string, unknown>;
  // Nest ConflictException: { statusCode, message: payload | string, ... }
  const nested = body.message;
  const payload =
    nested && typeof nested === 'object'
      ? (nested as Record<string, unknown>)
      : body;
  if (payload.code !== 'EXPENSE_DOCUMENT_REVIEW') return null;
  return payload as unknown as ExpenseDocumentReviewPayload;
}
