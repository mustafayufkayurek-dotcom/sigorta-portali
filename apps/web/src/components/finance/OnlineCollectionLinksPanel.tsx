'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';
import { useToast } from '@/contexts/ToastContext';
import {
  FinansActionButton,
  FinansDataTable,
  FinansEmptyState,
  FinansFieldLabel,
  FinansFormPanel,
  FinansPanelCard,
  finansInputClass,
} from '@/components/finance/FinansPanelUI';

function fmtCurrency(n: number) {
  return formatTryAmount(n, { fractionDigits: 0 });
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
  expired: 'Süresi Doldu',
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
    <FinansPanelCard
      title="Online Kart Tahsilat (PayTR)"
      subtitle={
        <>
          Sigortalıya güvenli ödeme linki gönderin — tahsilat otomatik kayda düşer.
          {activePending > 0 && (
            <span className="ml-1 font-medium text-amber-700">{activePending} bekleyen link</span>
          )}
        </>
      }
      action={{
        label: showForm ? 'Formu Kapat' : 'Ödeme Linki',
        onClick: () => setShowForm((v) => !v),
        variant: 'success',
        active: showForm,
      }}
    >
      {showForm && (
        <FinansFormPanel
          title="Yeni Ödeme Linki"
          onCancel={() => setShowForm(false)}
          onSubmit={handleCreate}
          submitLabel="Link Oluştur"
          saving={saving}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FinansFieldLabel required>Tutar (TRY)</FinansFieldLabel>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className={finansInputClass}
                placeholder="0"
              />
            </div>
            <div>
              <FinansFieldLabel>Sigortalı Adı</FinansFieldLabel>
              <input
                type="text"
                value={form.payerName}
                onChange={(e) => setForm({ ...form, payerName: e.target.value })}
                className={finansInputClass}
              />
            </div>
            <div>
              <FinansFieldLabel>E-posta</FinansFieldLabel>
              <input
                type="email"
                value={form.payerEmail}
                onChange={(e) => setForm({ ...form, payerEmail: e.target.value })}
                className={finansInputClass}
              />
            </div>
            <div>
              <FinansFieldLabel>Telefon</FinansFieldLabel>
              <input
                type="tel"
                value={form.payerPhone}
                onChange={(e) => setForm({ ...form, payerPhone: e.target.value })}
                className={finansInputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <FinansFieldLabel>Açıklama</FinansFieldLabel>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={finansInputClass}
                placeholder="Dosya kapanış ücreti vb."
              />
            </div>
          </div>
        </FinansFormPanel>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Yükleniyor…</div>
      ) : links.length === 0 ? (
        <FinansEmptyState
          title="Henüz Online Ödeme Linki Yok"
          description="Sigortalıya PayTR ile kart ödemesi almak için Ödeme Linki oluşturun."
        />
      ) : (
        <FinansDataTable>
          <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
            <tr>
              <th className="text-center px-3 py-2.5">Tutar</th>
              <th className="text-center px-3 py-2.5">Durum</th>
              <th className="text-center px-3 py-2.5">Sigortalı</th>
              <th className="text-center px-3 py-2.5">Son Geçerlilik</th>
              <th className="text-right px-3 py-2.5">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {links.map((link) => (
              <tr key={link.id} className="hover:bg-slate-50/80">
                <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-800">{fmtCurrency(link.amount)}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[link.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {STATUS_LABEL[link.status] ?? link.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-600">{link.payerName ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                  {fmtDate(link.tokenExpiresAt)}
                  {link.paidAt && <span className="block text-green-600">Ödendi: {fmtDate(link.paidAt)}</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex gap-2">
                    {['sent', 'opened', 'processing', 'draft'].includes(link.status) && (
                      <>
                        <FinansActionButton
                          label="Kopyala"
                          onClick={() => copyLink(link.paymentUrl)}
                          variant="neutral"
                        />
                        <button
                          type="button"
                          onClick={() => cancelLink(link.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1"
                        >
                          İptal
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </FinansDataTable>
      )}
    </FinansPanelCard>
  );
}
