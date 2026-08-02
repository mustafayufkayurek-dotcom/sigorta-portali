'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2 } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { FIELD_SURVEY_ITEM_TYPE_OPTIONS } from '@/components/field-survey/field-survey.constants';

type BriefRow = {
  id: string;
  title: string;
  itemType: string;
  status: string;
  createdAt: string;
};

function itemTypeLabel(code: string) {
  return FIELD_SURVEY_ITEM_TYPE_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

interface FieldSurveyBriefListProps {
  claimFileId: string;
  refreshKey?: number;
  canDelete?: boolean;
}

async function downloadPdf(
  claimFileId: string,
  briefId: string,
  variant: 'internal' | 'supplier',
) {
  const res = await axios.get(
    `${API}/claim-files/${claimFileId}/field-survey-briefs/${briefId}/pdf?variant=${variant}`,
    { headers: authHeader(), responseType: 'blob' },
  );
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${variant === 'supplier' ? 'tedarikci' : 'ic'}-kesif-${briefId.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function FieldSurveyBriefList({
  claimFileId,
  refreshKey = 0,
  canDelete = false,
}: FieldSurveyBriefListProps) {
  const [items, setItems] = useState<BriefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/claim-files/${claimFileId}/field-survey-briefs`, {
        headers: authHeader(),
      });
      const list = r.data?.data ?? r.data ?? [];
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [claimFileId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setMessage(null);
    try {
      await axios.delete(`${API}/claim-files/${claimFileId}/field-survey-briefs/${id}`, {
        headers: authHeader(),
      });
      setConfirmId(null);
      setMessage('Keşif kaydı silindi.');
      await load();
    } catch {
      setMessage('Silme başarısız.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return null;
  if (items.length === 0 && !message) return null;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">
        Saha Keşif Kayıtları ({items.length})
      </p>
      {message && <p className="mb-2 text-xs text-slate-600">{message}</p>}
      <ul className="space-y-2">
        {items.slice(0, 10).map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{row.title}</p>
              <p className="text-xs text-slate-500">{itemTypeLabel(row.itemType)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="text-xs font-semibold text-brand-600 hover:underline"
                onClick={() => void downloadPdf(claimFileId, row.id, 'internal')}
              >
                İç Pdf
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-brand-600 hover:underline"
                onClick={() => void downloadPdf(claimFileId, row.id, 'supplier')}
              >
                Tedarikçi Pdf
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-status-danger hover:bg-red-50"
                  onClick={() => setConfirmId(row.id)}
                  aria-label="Sil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Sil
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {confirmId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => !deleting && setConfirmId(null)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-sm font-semibold text-slate-800">Keşif Kaydını Sil</p>
            <p className="mt-2 text-xs text-slate-600">
              Bu kayıt ve ilişkili PDF tamamen silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmId(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete(confirmId)}
                className="rounded-xl bg-status-danger px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? 'Siliniyor…' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
