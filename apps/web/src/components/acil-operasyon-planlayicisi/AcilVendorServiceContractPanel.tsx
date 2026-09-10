'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import {
  VendorContractPreviewModal,
  type VendorContractPreviewTarget,
} from '@/components/hasar-operasyon-planlayicisi/VendorContractPreviewModal';

export function AcilVendorServiceContractPanel({
  emergencyCaseId,
  vendorId,
  vendorName,
  vendorPhone,
}: {
  emergencyCaseId: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
}) {
  const [contracts, setContracts] = useState<
    Array<{
      id: string;
      vendorId: string;
      contractNo: string;
      status: string;
      vendor?: { phone?: string | null };
      correctionRequest?: { status?: string; note?: string } | null;
    }>
  >([]);
  const [preview, setPreview] = useState<VendorContractPreviewTarget | null>(null);

  const load = useCallback(() => {
    if (!emergencyCaseId) return;
    axios
      .get(`${API}/vendor-contracts?emergencyCaseId=${emergencyCaseId}`, { headers: authHeader() })
      .then((r) => setContracts(r.data.data || []))
      .catch(() => setContracts([]));
  }, [emergencyCaseId]);

  useEffect(() => {
    load();
  }, [load]);

  const active = contracts.find((c) => c.vendorId === vendorId && c.status !== 'cancelled');

  const openPreview = () => {
    setPreview({
      emergencyCaseId,
      vendorId,
      vendorName,
      vendorPhone: vendorPhone || active?.vendor?.phone || '',
      existingId: active?.id ?? null,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" data-testid="acil-hizmet-alim-sozlesmesi">
      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.acilVendorServiceContract.id}
        title={OPS_NOTICE.acilVendorServiceContract.title}
        body={OPS_NOTICE.acilVendorServiceContract.body}
        testId="acil-hizmet-alim-ilk-kullanim-seridi"
        className="acil-hizmet-alim-ilk-kullanim-seridi"
      />
      <p className="mb-2 text-[11px] font-bold text-slate-800">Tedarikçi Hizmet Alım Sözleşmesi</p>
      <p className="text-[11px] leading-relaxed text-slate-600">
        Kısa süreli hizmet içindir. WhatsApp ile onay sayfasına gider. Hasar onarım metni kullanılmaz.
      </p>
      {active ? (
        <p className="mt-1.5 text-[11px] text-slate-600">
          {active.contractNo}
          {active.status === 'vendor_signed' ? ' · Onaylandı' : ''}
          {active.correctionRequest?.status === 'pending' ? ' · Yönetici düzeltmesi bekleniyor' : ''}
        </p>
      ) : null}
      <button
        type="button"
        onClick={openPreview}
        className="mt-2 cursor-pointer rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
      >
        Sözleşmeyi gör
      </button>
      {!vendorPhone ? (
        <p className="mt-1 text-[10px] text-status-danger">Tedarikçi telefonu yok.</p>
      ) : null}
      {preview ? (
        <VendorContractPreviewModal
          target={preview}
          onClose={() => setPreview(null)}
          onDone={() => load()}
        />
      ) : null}
    </div>
  );
}
