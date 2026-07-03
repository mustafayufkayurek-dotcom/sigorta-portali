'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader, fmtDate } from '../claim-detail-utils';
import { Badge } from '../claim-detail-ui';

export function GorevlerTab({ claimId }: { claimId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/tasks?claimFileId=${claimId}`, { headers: authHeader() })
      .then((r) => setTasks(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;
  if (!tasks.length) return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
        </div>
        <p className="text-sm font-semibold text-slate-600">Henüz Görev Eklenmedi</p>
        <p className="text-xs text-slate-400 mt-1">Bu dosyaya ait görev bulunmuyor.</p>
      </div>
    </div>
  );

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="space-y-3">
      {tasks.map((t) => (
        <div key={t.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-800 text-sm">{t.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t.taskType} · {fmtDate(t.dueAt)}</p>
          </div>
          <Badge text={t.status} color={statusColor[t.status] ?? 'bg-slate-100 text-slate-600'} />
        </div>
      ))}
    </div>
  );
}
