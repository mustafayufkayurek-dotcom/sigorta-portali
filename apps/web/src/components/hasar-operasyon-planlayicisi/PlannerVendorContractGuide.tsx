'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { usePlanner } from './planner-context';
import { VendorContractPreviewModal, type VendorContractPreviewTarget } from './VendorContractPreviewModal';
import { isHasarVendorContractWaived } from '@sigorta/shared';

export function PlannerVendorContractGuide() {
  const { claim, assignedSupplierIds } = usePlanner();
  const [contracts, setContracts] = useState<Array<{
    id: string;
    vendorId: string;
    contractNo: string;
    status: string;
    vendor?: { phone?: string | null };
    correctionRequest?: { status?: string; note?: string } | null;
  }>>([]);
  const [preview, setPreview] = useState<VendorContractPreviewTarget | null>(null);

  const ids = assignedSupplierIds.length ? assignedSupplierIds : claim.preAssignedSupplierIds;
  const vendors = claim.suppliers.filter((s) => ids.includes(s.id));
  const waived = isHasarVendorContractWaived({ id: claim.claimId, fileNo: claim.fileNo });

  const load = useCallback(() => {
    if (!claim.claimId) return;
    axios
      .get(`${API}/vendor-contracts?claimFileId=${claim.claimId}`, { headers: authHeader() })
      .then((r) => setContracts(r.data.data || []))
      .catch(() => setContracts([]));
  }, [claim.claimId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!claim.claimId) return null;
  if (waived) {
    return (
      <p className="text-xs text-slate-500">Bu dosyada tedarikçi sözleşmesi yüklenmez.</p>
    );
  }

  const openPreview = (vendorId: string, vendorName: string, vendorPhone: string, existingId?: string | null) => {
    if (!claim.claimId) return;
    setPreview({
      claimId: claim.claimId,
      vendorId,
      vendorName,
      vendorPhone,
      repairReportId: claim.report.id,
      existingId: existingId ?? null,
    });
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.hasarVendorContractKind.id}
        title={OPS_NOTICE.hasarVendorContractKind.title}
        body={OPS_NOTICE.hasarVendorContractKind.body}
        testId="hasar-vendor-contract-ilk-kullanim-seridi"
        className="hasar-vendor-contract-ilk-kullanim-seridi"
      />
      <p className="text-xs font-semibold text-slate-800">Tedarikçi sözleşmesi</p>
      <p className="text-[11px] leading-relaxed text-slate-600">
        Sözleşmeyi burada görürsünüz. Metin yanlışsa yöneticiden düzeltme isteyin. Gönderim WhatsApp ile onay sayfasına gider.
      </p>
      {vendors.length === 0 ? (
        <p className="text-[11px] text-slate-500">Önce tedarikçi atayın.</p>
      ) : (
        <div className="space-y-2">
          {vendors.map((s) => {
            const active = contracts.find(
              (c) => c.vendorId === s.id && c.status !== 'cancelled',
            );
            return (
              <div key={s.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                <p className="text-xs font-semibold text-slate-900">{s.name}</p>
                {active ? (
                  <>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {active.contractNo}
                      {active.status === 'vendor_signed' ? ' · İmzalandı' : ''}
                      {active.correctionRequest?.status === 'pending' ? ' · Yönetici düzeltmesi bekleniyor' : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => openPreview(s.id, s.name, s.phone || active.vendor?.phone || '', active.id)}
                      className="mt-2 cursor-pointer rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
                    >
                      Sözleşmeyi gör
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openPreview(s.id, s.name, s.phone || '')}
                    className="mt-2 cursor-pointer rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
                  >
                    Sözleşmeyi gör
                  </button>
                )}
                {!s.phone ? (
                  <p className="mt-1 text-[10px] text-status-danger">Tedarikçi telefonu yok.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
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
