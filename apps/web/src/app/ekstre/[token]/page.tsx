'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}
function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('tr-TR') : '—';
}

const APPROVAL_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:       { label: 'Bekliyor',        color: 'bg-yellow-100 text-yellow-700' },
  APPROVED:      { label: 'Onaylandı',       color: 'bg-green-100 text-green-700' },
  AUTO_APPROVED: { label: 'Oto. Onaylandı',  color: 'bg-teal-100 text-teal-700' },
  DISPUTED:      { label: 'İtiraz Edildi',   color: 'bg-red-100 text-red-700' },
};

const DISPUTE_REASONS: { value: string; label: string }[] = [
  { value: 'AMOUNT_MISMATCH', label: 'Tutar yanlış' },
  { value: 'ITEM_NOT_DONE',   label: 'Bu iş yapılmadı' },
  { value: 'WRONG_CLAIM',     label: 'Yanlış dosyaya bağlanmış' },
  { value: 'NOT_RECEIVED',    label: 'Ödemeyi almadım' },
  { value: 'OTHER',           label: 'Diğer (açıklama zorunlu)' },
];

export default function VendorStatementPage() {
  const params = useParams();
  const token = params?.token as string;

  const [statement, setStatement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [disputeModal, setDisputeModal] = useState<{ itemId: string; description: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/public/vendor-statements/token/${token}`);
      setStatement(res.data);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Ekstre yüklenemedi. Bağlantı geçersiz veya süresi dolmuş olabilir.');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleApproveAll = async () => {
    if (!confirm('Tüm kalemleri onaylıyor musunuz?')) return;
    setApproving('all');
    try {
      await axios.post(`${API}/public/vendor-statements/token/${token}/approve-all`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Onaylama hatası');
    }
    setApproving(null);
  };

  const handleApproveItem = async (itemId: string) => {
    setApproving(itemId);
    try {
      await axios.post(`${API}/public/vendor-statements/token/${token}/items/${itemId}/approve`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Onaylama hatası');
    }
    setApproving(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Ekstre yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !statement) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Ekstre Açılamadı</h2>
          <p className="text-sm text-gray-500">{error || 'Geçersiz bağlantı'}</p>
          <p className="text-xs text-gray-400 mt-4">
            Sorun devam ederse Meridyen Assistance ile iletişime geçiniz.
          </p>
        </div>
      </div>
    );
  }

  const isExpired = statement.deadlineAt && new Date() > new Date(statement.deadlineAt);
  const pendingItems = statement.items?.filter((i: any) => i.approvalStatus === 'PENDING') ?? [];
  const disputedItems = statement.items?.filter((i: any) => i.approvalStatus === 'DISPUTED') ?? [];
  const approvedItems = statement.items?.filter(
    (i: any) => i.approvalStatus === 'APPROVED' || i.approvalStatus === 'AUTO_APPROVED'
  ) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">M</span>
              </div>
              <span className="text-sm font-semibold text-gray-800">Meridyen Assistance</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 ml-9">Ödeme Ekstre & Mutabakat Sistemi</p>
          </div>
          {statement.deadlineAt && (
            <div className={`text-xs px-2 py-1 rounded-lg font-medium ${
              isExpired ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {isExpired ? 'Süre Doldu' : `Son: ${fmtDate(statement.deadlineAt)}`}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Ekstre Başlık Kartı */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-base font-bold text-gray-900">Ödeme Ekstresi</h1>
                <p className="text-sm text-gray-500 mt-0.5">{statement.statementNo}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-indigo-700">{fmtCurrency(statement.totalAmount)}</p>
                <p className="text-xs text-gray-400">Toplam Tutar</p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400">Tedarikçi</p>
              <p className="font-semibold text-gray-800 mt-0.5">{statement.vendor?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Dönem</p>
              <p className="font-medium text-gray-700 mt-0.5">
                {fmtDate(statement.periodStart)} – {fmtDate(statement.periodEnd)}
              </p>
            </div>
            {statement.notes && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Not</p>
                <p className="text-gray-600 mt-0.5">{statement.notes}</p>
              </div>
            )}
          </div>

          {/* İlerleme özeti */}
          <div className="px-5 pb-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Onaylanan', count: approvedItems.length, color: 'text-green-600' },
                { label: 'Bekleyen', count: pendingItems.length, color: 'text-yellow-600' },
                { label: 'İtirazlı', count: disputedItems.length, color: 'text-red-600' },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-2">
                  <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Uyarı Bandı */}
        {isExpired ? (
          <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 text-center">
            Mutabakat süresi dolmuştur. Bekleyen kalemler otomatik onaylanmıştır.
          </div>
        ) : pendingItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-amber-800">
              {pendingItems.length} kalem onayınızı bekliyor
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Son tarih: {fmtDate(statement.deadlineAt)} — Bu tarihten sonra kalemler otomatik onaylanacaktır.
            </p>
          </div>
        )}

        {/* Toplu Onayla */}
        {!isExpired && pendingItems.length > 0 && (
          <button
            onClick={handleApproveAll}
            disabled={approving === 'all'}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors"
          >
            {approving === 'all' ? 'İşleniyor...' : `Tüm ${pendingItems.length} Kalemi Onayla`}
          </button>
        )}

        {/* Kalemler */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 px-1">Ödeme Kalemleri</h2>
          {statement.items?.map((item: any) => {
            const st = APPROVAL_STATUS[item.approvalStatus] ?? APPROVAL_STATUS.PENDING;
            const isPending = item.approvalStatus === 'PENDING';
            const isDisputed = item.approvalStatus === 'DISPUTED';
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{item.lineDescription}</p>
                      {item.claimFile && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Dosya: {item.claimFile.fileNo}
                          {item.workGroup && ` · ${item.workGroup.name}`}
                        </p>
                      )}
                      {item.receiptRef && (
                        <p className="text-xs text-gray-400">Dekont: {item.receiptRef}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-sm font-bold text-gray-800">{fmtCurrency(item.totalAmount)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </div>
                  </div>

                  {/* İtiraz Detayı */}
                  {isDisputed && item.disputeRecord && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs font-medium text-red-700">
                        İtiraz: {DISPUTE_REASONS.find(r => r.value === item.disputeRecord.reason)?.label ?? item.disputeRecord.reason}
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">{item.disputeRecord.reasonNote}</p>
                    </div>
                  )}

                  {/* Aksiyonlar */}
                  {isPending && !isExpired && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                      <button
                        onClick={() => handleApproveItem(item.id)}
                        disabled={approving === item.id}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        {approving === item.id ? '...' : 'Onayla'}
                      </button>
                      <button
                        onClick={() => setDisputeModal({ itemId: item.id, description: item.lineDescription })}
                        className="flex-1 py-2 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold rounded-lg transition-colors"
                      >
                        İtiraz Et
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dekont Bilgisi */}
        {statement.receipts?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="text-sm font-semibold text-gray-800">Ödeme Dekontları</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {statement.receipts.map((receipt: any) => (
                <div key={receipt.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{receipt.fileName}</p>
                    {receipt.bankRef && (
                      <p className="text-xs text-gray-400">Ref: {receipt.bankRef} · {fmtDate(receipt.bankDate)}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-green-700">{fmtCurrency(receipt.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4 text-xs text-gray-400 space-y-1">
          <p>Meridyen Assistance — Sigorta Hasar Onarım Hizmetleri</p>
          <p>Bu ekstre ile ilgili sorularınız için ofisimizi arayınız.</p>
        </div>
      </div>

      {/* İtiraz Modal */}
      {disputeModal && (
        <DisputeModal
          token={token}
          itemId={disputeModal.itemId}
          itemDescription={disputeModal.description}
          onClose={() => setDisputeModal(null)}
          onSubmitted={() => { setDisputeModal(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── DisputeModal ─────────────────────────────────────────────────────────────
function DisputeModal({
  token,
  itemId,
  itemDescription,
  onClose,
  onSubmitted,
}: {
  token: string;
  itemId: string;
  itemDescription: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!reason) { setError('İtiraz sebebi seçiniz'); return; }
    if (reasonNote.trim().length < 20) { setError('Açıklama en az 20 karakter olmalıdır'); return; }

    setSaving(true);
    try {
      await axios.post(
        `${API}/public/vendor-statements/token/${token}/items/${itemId}/dispute`,
        { reason, reasonNote: reasonNote.trim() },
      );
      onSubmitted();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'İtiraz gönderilemedi');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">İtiraz Bildir</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-400">İtiraz ettiğiniz kalem</p>
            <p className="text-sm font-medium text-gray-800 mt-0.5">{itemDescription}</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">İtiraz Sebebi</label>
            <div className="space-y-2">
              {DISPUTE_REASONS.map((r) => (
                <label key={r.value} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  reason === r.value ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value}
                    onChange={() => setReason(r.value)} className="accent-red-600" />
                  <span className="text-sm text-gray-700">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Açıklama <span className="text-red-400">*</span>
              <span className="text-gray-400 font-normal ml-1">(en az 20 karakter)</span>
            </label>
            <textarea
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              rows={3}
              placeholder="İtiraz nedeninizi detaylı olarak açıklayınız..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{reasonNote.length}/20+ karakter</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700 font-medium">Önemli Bilgi</p>
            <p className="text-xs text-amber-600 mt-0.5">
              İtirazınız ofisimize iletilecek ve en kısa sürede incelenecektir. Gerçeğe aykırı itiraz
              sözleşme koşullarınızı etkileyebilir.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Gönderiliyor...' : 'İtiraz Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}
