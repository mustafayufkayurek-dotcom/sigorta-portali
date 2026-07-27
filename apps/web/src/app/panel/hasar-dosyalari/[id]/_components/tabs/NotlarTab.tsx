'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '../claim-detail-utils';

export function NotlarTab({ claimId }: { claimId: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/notes?claimFileId=${claimId}`, { headers: authHeader() })
      .then((r) => setNotes(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;
  if (!notes.length) return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
        </div>
        <p className="text-sm font-semibold text-slate-600">Henüz Not Eklenmedi</p>
        <p className="text-xs text-slate-400 mt-1">Bu dosyaya ait not bulunmuyor.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <div key={n.id} className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-600 bg-blue-50 px-2 py-0.5 rounded">{n.noteType}</span>
            <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('tr-TR')}</span>
          </div>
          <p className="text-sm text-slate-700">{n.content}</p>
          <p className="text-xs text-slate-400 mt-1">{n.author?.firstName} {n.author?.lastName}</p>
        </div>
      ))}
    </div>
  );
}
