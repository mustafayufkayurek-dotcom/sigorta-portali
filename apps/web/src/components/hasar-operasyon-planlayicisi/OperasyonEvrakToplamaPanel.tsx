'use client';

import { FieldInspectionPhotosPanel } from '@/components/field-survey/FieldInspectionPhotosPanel';
import { VendorRepairPhotosPanel } from '@/components/field-survey/VendorRepairPhotosPanel';
import { ClaimManualDocumentsPanel } from '@/components/file-documents/ClaimManualDocumentsPanel';
import FileDocumentPanel from '@/components/file-documents/FileDocumentPanel';

/** Evraklar → Tespit Ve Onarım: tespit / onarım resmi ve yüklenen evrak birikir. Yükleme bu listede yok. */
export function OperasyonEvrakToplamaPanel({
  claimId,
  suppliers,
}: {
  claimId: string;
  suppliers: Array<{ id: string; name?: string | null; companyName?: string | null }>;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Tespit Ve Onarım</h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Tespit resmi, onarım bitiş resmi ve bu işe ait belgeler. Yükleme planlayıcıdaki Evrak Yükleme
          adımı ve Evraklar → Özet’tedir.
        </p>
      </div>
      <section>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Tespit resimleri
        </h4>
        <FieldInspectionPhotosPanel claimId={claimId} readOnly />
      </section>
      <section>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Onarım bitiş resimleri
        </h4>
        {suppliers.length === 0 ? (
          <p className="text-xs text-slate-500">Atanmış tedarikçi yok.</p>
        ) : (
          suppliers.map((s) => (
            <VendorRepairPhotosPanel
              key={s.id}
              claimId={claimId}
              vendorId={s.id}
              vendorName={s.name ?? s.companyName ?? 'Tedarikçi'}
              readOnly
            />
          ))
        )}
      </section>
      <section>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Dijital onay belgesi
        </h4>
        <FileDocumentPanel entityType="claim_file" entityId={claimId} documentKind="muvafakatname" />
      </section>
      <section>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Yüklenen evraklar
        </h4>
        <ClaimManualDocumentsPanel claimId={claimId} listOnly />
      </section>
    </div>
  );
}
