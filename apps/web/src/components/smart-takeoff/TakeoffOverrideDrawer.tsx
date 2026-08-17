'use client';

import { useEffect, useState } from 'react';
import { SlidePanel } from '@/components/SlidePanel';
import { LoadingButton } from '@/components/ui/LoadingButton';
import type { TakeoffLineItem } from './smart-takeoff.types';
import { formatTakeoffQuantity } from './smart-takeoff-api';

type TakeoffOverrideDrawerProps = {
  open: boolean;
  lineItem: TakeoffLineItem | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (quantityOverride: number, reason: string) => Promise<void>;
};

export function TakeoffOverrideDrawer({
  open,
  lineItem,
  saving,
  onClose,
  onSubmit,
}: TakeoffOverrideDrawerProps) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lineItem || !open) return;
    setQuantity(String(lineItem.quantityFinal));
    setReason('');
    setError(null);
  }, [lineItem, open]);

  if (!lineItem) return null;

  const handleSubmit = async () => {
    const parsed = Number(quantity.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Geçerli bir miktar girin.');
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('Düzeltme gerekçesi zorunludur.');
      return;
    }
    setError(null);
    await onSubmit(parsed, trimmedReason);
  };

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Manuel Düzeltme"
      subtitle={lineItem.displayName}
      width={440}
      scrollContent={false}
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-4 p-4">
          <p className="text-xs text-slate-500">
            Motor hesabı korunur; yalnız kullanılan miktar güncellenir ve audit kaydı oluşturulur.
          </p>

          <div>
            <label className="text-xs font-medium text-slate-600">Motor Miktarı</label>
            <p className="mt-1 text-sm text-slate-800">
              {formatTakeoffQuantity(lineItem.quantityEngine, lineItem.unit)}
            </p>
          </div>

          <div>
            <label htmlFor="takeoff-override-qty" className="text-xs font-medium text-slate-600">
              Yeni Miktar
            </label>
            <input
              id="takeoff-override-qty"
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <div>
            <label htmlFor="takeoff-override-reason" className="text-xs font-medium text-slate-600">
              Gerekçe
            </label>
            <textarea
              id="takeoff-override-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              placeholder="Saha ölçümü farkı, onaylı düzeltme vb."
            />
          </div>

          {error ? (
            <p className="text-xs text-status-danger">{error}</p>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-slate-100 p-4">
          <LoadingButton type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Vazgeç
          </LoadingButton>
          <LoadingButton
            type="button"
            className="flex-1"
            loading={saving}
            onClick={() => void handleSubmit()}
          >
            Kaydet
          </LoadingButton>
        </div>
      </div>
    </SlidePanel>
  );
}
