'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '../claim-detail-utils';
import { useToast } from '@/contexts/ToastContext';
import { openWhatsAppChat } from '@/utils/date-helpers';
import { VendorContractPreviewModal, type VendorContractPreviewTarget } from '@/components/hasar-operasyon-planlayicisi/VendorContractPreviewModal';
import { usePanelConfirm } from '@/components/ui/use-panel-confirm';

const CONTRACT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Taslak', color: 'bg-slate-100 text-slate-700' },
  ready: { label: 'Hazır', color: 'bg-blue-100 text-blue-700' },
  sent: { label: 'Gönderildi', color: 'bg-amber-100 text-amber-700' },
  vendor_signed: { label: 'İmzalandı', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'İptal Edildi', color: 'bg-red-100 text-red-700' },
};

export function SozlesmelerSection({ claimId, hideHeader = false }: { claimId: string; hideHeader?: boolean }) {
  const { showToast } = useToast();
  const { confirm, dialog } = usePanelConfirm();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappModal, setWhatsappModal] = useState<{ id: string; phone: string } | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [waSending, setWaSending] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [preview, setPreview] = useState<VendorContractPreviewTarget | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/vendor-contracts?claimFileId=${claimId}`, { headers: authHeader() })
      .then((r) => setContracts(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleSendWhatsapp = async () => {
    if (!whatsappModal) return;
    setWaSending(true);
    try {
      const r = await axios.post(
        `${API}/vendor-contracts/${whatsappModal.id}/send-whatsapp`,
        { phone: whatsappModal.phone },
        { headers: authHeader() },
      );
      const payload = r.data.data ?? {};
      const msg = payload.message ?? '';
      openWhatsAppChat(whatsappModal.phone, msg);
      setWaLink(payload.waUrl);
      load();
    } catch { showToast('error', 'Hata Oluştu'); }
    finally { setWaSending(false); }
  };

  const handleCancel = async (id: string) => {
    if (!(await confirm('Bu sözleşmeyi iptal etmek istediğinize emin misiniz?'))) return;
    setCancelling(id);
    try {
      await axios.delete(`${API}/vendor-contracts/${id}`, { headers: authHeader() });
      load();
    } catch { showToast('error', 'İptal Sırasında Hata Oluştu'); }
    finally { setCancelling(null); }
  };

  const handleDownloadPdf = (id: string, contractNo: string) => {
    const link = document.createElement('a');
    link.href = `${API}/vendor-contracts/${id}/pdf`;
    link.setAttribute('download', `sozlesme_${contractNo}.pdf`);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div>
      {!hideHeader && (
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Tedarikçi Sözleşmeleri</h3>
        <p className="text-xs text-slate-500 mt-0.5">Burada toplanan onaylar durur. Yeni onay Operasyonu Başlat → Onarım Planlama’dadır.</p>
      </div>
      )}
      {hideHeader && (
        <p className="text-xs text-slate-500 mb-3">Toplanan tedarikçi onayları. Yeni sözleşme Operasyonu Başlat → Onarım Planlama’dadır.</p>
      )}

      {loading ? (
        <div className="py-6 text-center text-sm text-slate-400">Yükleniyor…</div>
      ) : contracts.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-sm text-slate-400">Henüz toplanmış tedarikçi onayı yok.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => {
            const st = CONTRACT_STATUS_LABELS[c.status] ?? { label: c.status, color: 'bg-slate-100 text-slate-600' };
            return (
              <div key={c.id} className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{c.contractNo}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      Tedarikçi Sözleşmesi
                    </span>
                    {c.status === 'sent' && c.reminderCount > 0 && (
                      <span className="text-xs text-amber-600 font-medium">{c.reminderCount} Hatırlatma</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {c.vendor?.name} · {new Date(c.contractDate).toLocaleDateString('tr-TR')}
                    {c.signDeadlineAt && c.status !== 'vendor_signed' && c.status !== 'cancelled' && (
                      <span className="ml-2 text-status-danger">Son İmza: {new Date(c.signDeadlineAt).toLocaleDateString('tr-TR')}</span>
                    )}
                    {c.signedAt && (
                      <span className="ml-2 text-green-600">İmzalandı: {new Date(c.signedAt).toLocaleDateString('tr-TR')}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreview({
                      claimId,
                      vendorId: c.vendorId,
                      vendorName: c.vendor?.name ?? c.vendorName ?? 'Tedarikçi',
                      vendorPhone: c.vendor?.phone ?? '',
                      existingId: c.id,
                    })}
                    title="Önizle"
                    className="inline-flex items-center justify-center h-8 px-2 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 text-[11px] font-semibold"
                  >
                    Önizle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(c.id, c.contractNo)}
                    title="PDF İndir"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                  {c.status !== 'cancelled' && c.status !== 'vendor_signed' && (
                    <button
                      type="button"
                      onClick={() => setWhatsappModal({ id: c.id, phone: c.vendor?.phone ?? '' })}
                      title="WhatsApp Gönder"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
                  )}
                  {c.status !== 'cancelled' && c.status !== 'vendor_signed' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(c.id)}
                      disabled={cancelling === c.id}
                      title="İptal Et"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-status-danger hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {whatsappModal && !waLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">WhatsApp ile Gönder</h3>
            <label className="block text-xs font-medium text-slate-600 mb-1">Telefon Numarası</label>
            <input
              type="tel"
              value={whatsappModal.phone}
              onChange={(e) => setWhatsappModal({ ...whatsappModal, phone: e.target.value })}
              placeholder="05xx xxx xx xx"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setWhatsappModal(null)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
              <button
                type="button"
                onClick={handleSendWhatsapp}
                disabled={waSending || !whatsappModal.phone}
                className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {waSending ? 'Kaydediliyor…' : 'Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {waLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <p className="text-sm font-medium text-slate-800 mb-1">WhatsApp açıldı</p>
            <p className="text-xs text-slate-500 mb-4">Mesaj gitmediyse aşağıdaki düğmeyle tekrar açın.</p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors mb-2"
            >
              WhatsApp&apos;ta Aç
            </a>
            <button type="button" onClick={() => { setWaLink(null); setWhatsappModal(null); }} className="text-xs text-slate-500 hover:text-slate-700">Kapat</button>
          </div>
        </div>
      )}
      {preview ? (
        <VendorContractPreviewModal
          target={preview}
          onClose={() => setPreview(null)}
          onDone={() => load()}
        />
      ) : null}
      {dialog}
    </div>
  );
}
