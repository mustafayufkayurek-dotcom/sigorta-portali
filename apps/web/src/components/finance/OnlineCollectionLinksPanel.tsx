'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { useToast } from '@/contexts/ToastContext';

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR');
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  opened: 'Açıldı',
  processing: 'İşleniyor',
  paid: 'Ödendi',
  expired: 'Süresi doldu',
  cancelled: 'İptal',
  failed: 'Başarısız',
};

const STATUS_COLOR: Record<string, string> = {
  sent: 'bg-blue-50 text-blue-700 border-blue-100',
  opened: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  paid: 'bg-green-50 text-green-700 border-green-100',
  expired: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  failed: 'bg-red-50 text-red-700 border-red-100',
};

type CollectionLink = {
  id: string;
  amount: number;
  status: string;
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;
  description?: string;
  tokenExpiresAt: string;
  paymentUrl: string;
  paidAt?: string;
};

export function OnlineCollectionLinksPanel({ claimFileId }: { claimFileId: string }) {
  const { showToast } = useToast();
  const [links, setLinks] = useState<CollectionLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: '', payerName: '', payerEmail: '', payerPhone: '', description: '' });

  const load = useCallback(() => {
    setLoading(true);
    axios
      .get(`${API}/claim-files/${claimFileId}/collection-links`, { headers: authHeader() })
      .then((r) => setLinks(r.data.data ?? []))
      .catch(() => setLinks([]))
      .finally(() => setLoading(false));
  }, [claimFileId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      showToast('error', 'Geçerli bir tutar girin.');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/collection-links`,
        {
          claimFileId,
          amount,
          payerName: form.payerName.trim() || undefined,
          payerEmail: form.payerEmail.trim() || undefined,
          payerPhone: form.payerPhone.trim() || undefined,
          description: form.description.trim() || undefined,
        },
        { headers: authHeader() },
      );
      const url = res.data.data?.paymentUrl;
      setShowForm(false);
      setForm({ amount: '', payerName: '', payerEmail: '', payerPhone: '', description: '' });
      load();
      if (url) {
        await navigator.clipboard.writeText(url).catch(() => {});
        showToast('success', 'Ödeme linki oluşturuldu ve panoya kopyalandı.');
      } else {
        showToast('success', 'Ödeme linki oluşturuldu.');
      }
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : 'Link oluşturulamadı.';
      showToast('error', typeof msg === 'string' ? msg : 'Link oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    showToast('success', 'Link kopyalandı.');
  };

  const cancelLink = async (id: string) => {
    if (!confirm('Bu ödeme linkini iptal etmek istiyor musunuz?')) return;
    try {
      await axios.post(`${API}/collection-links/${id}/cancel`, {}, { headers: authHeader() });
      showToast('success', 'Link iptal edildi.');
      load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : 'İptal edilemedi.';
      showToast('error', typeof msg === 'string' ? msg : 'İptal edilemedi.');
    }
  };

  const activePending = links.filter((l) => ['sent', 'opened', 'processing', 'draft'].includes(l.status)).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Online Kart Tahsilat (PayTR)</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Sigortalıya güvenli ödeme linki gönderin — tahsilat otomatik kayda düşer.
            {activePending > 0 && <span className="ml-1 text-yellow-700 font-medium">{activePending} bekleyen link</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
        >
          + Ödeme Linki
        </button>
      </div>

      {showForm && (
        <div className="px-4 py-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tutar (TRY) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Sigortalı adı</label>
              <input
                type="text"
                value={form.payerName}
                onChange={(e) => setForm({ ...form, payerName: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">E-posta</label>
              <input
                type="email"
                value={form.payerEmail}
                onChange={(e) => setForm({ ...form, payerEmail: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Telefon</label>
              <input
                type="tel"
                value={form.payerPhone}
                onChange={(e) => setForm({ ...form, payerPhone: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">Açıklama</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Dosya kapanış ücreti vb."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600">İptal</button>
            <button type="button" onClick={handleCreate} disabled={saving} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Oluşturuluyor…' : 'Link Oluştur'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-6 text-center text-sm text-slate-400">Yükleniyor…</div>
      ) : links.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-400">Henüz online ödeme linki yok.</div>
      ) : (
        <div className="divide-y divide-slate-50">
          {links.map((link) => (
            <div key={link.id} className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{fmtCurrency(link.amount)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[link.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {STATUS_LABEL[link.status] ?? link.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {link.payerName ?? '—'} · son: {fmtDate(link.tokenExpiresAt)}
                  {link.paidAt && ` · ödendi: ${fmtDate(link.paidAt)}`}
                </p>
              </div>
              <div className="flex gap-2">
                {['sent', 'opened', 'processing', 'draft'].includes(link.status) && (
                  <>
                    <button type="button" onClick={() => copyLink(link.paymentUrl)} className="text-xs text-blue-600 hover:underline">Kopyala</button>
                    <button type="button" onClick={() => cancelLink(link.id)} className="text-xs text-red-500 hover:underline">İptal</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
