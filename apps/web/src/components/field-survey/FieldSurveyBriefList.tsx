'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
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
}

export function FieldSurveyBriefList({ claimFileId, refreshKey = 0 }: FieldSurveyBriefListProps) {
  const [items, setItems] = useState<BriefRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading || items.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <p className="text-xs font-semibold text-slate-600 mb-2">Saha Keşif Kayıtları ({items.length})</p>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-800 font-medium">{row.title}</span>
            <span className="text-xs text-slate-500">{itemTypeLabel(row.itemType)}</span>
            <a
              href={`${API}/claim-files/${claimFileId}/field-survey-briefs/${row.id}/pdf`}
              className="text-xs text-blue-600 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                void axios
                  .get(`${API}/claim-files/${claimFileId}/field-survey-briefs/${row.id}/pdf`, {
                    headers: authHeader(),
                    responseType: 'blob',
                  })
                  .then((res) => {
                    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `kesif-${row.id.slice(0, 8)}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  });
              }}
            >
              PDF
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
