'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import SpeechToText from '@/components/SpeechToText';
import { useToast } from '@/contexts/ToastContext';
import { API, authAxios } from '../claim-detail-utils';

export function TalimatlarTab({ claimId }: { claimId: string }) {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authAxios<{ data: any[] }>({
        method: 'GET',
        url: `${API}/notes?claimFileId=${claimId}&noteType=manager_instruction`,
      });
      setNotes(r.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await authAxios({
        method: 'POST',
        url: `${API}/notes`,
        data: { claimFileId: claimId, content: content.trim(), noteType: 'manager_instruction' },
      });
      setContent('');
      load();
    } catch (e: any) {
      if (axios.isAxiosError(e) && e.response?.status === 401) return;
      showToast('error', e?.response?.data?.message ?? 'Talimat kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Yeni Talimat Girişi */}
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-5">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs">!</span>
          Yönetici Talimatı / Notu Ekle
        </h4>
        <div className="relative">
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-14 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
            rows={3}
            placeholder="Personele talimat veya açıklama yazın..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="absolute bottom-2 right-2">
            <SpeechToText
              size="sm"
              onTranscript={(text) => setContent((prev) => prev ? prev + ' ' + text : text)}
            />
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Kaydediliyor...' : 'Talimat Kaydet'}
          </button>
        </div>
      </div>

      {/* Talimat Listesi */}
      {loading ? (
        <div className="text-slate-400 py-8 text-center text-sm">Yükleniyor...</div>
      ) : notes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm font-semibold text-slate-500">Henüz Talimat Eklenmedi</p>
          <p className="text-xs text-slate-400 mt-1">Yukarıdaki formu kullanarak talimat ekleyebilirsiniz.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="bg-amber-50 rounded-xl border border-amber-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-xs font-bold shrink-0">!</span>
                  <span className="text-xs font-semibold text-amber-700">
                    {n.author?.firstName} {n.author?.lastName}
                  </span>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {new Date(n.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap pl-8">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

