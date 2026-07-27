'use client';

import { useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import { InboxOpenFileModal } from '@/components/operation-inbox/InboxOpenFileModal';
import { buildInboxFileOpenDraft } from '@/utils/inbox-file-open-draft';

const REMED_SAMPLE_BODY = `
KONUT HASAR İHBAR FORMU
Sigorta Şirketi: Türkiye Sigorta
Sigorta Ettiren Ad-Soyad: Emin Ali Yiğit
Dosya No: 2026041287
Poliçe No: 1234567890
Referans No: RCS-987654321
İletişim No: 0532 111 22 33
Hasar Şekli: Su Baskını
Adres: İstanbul / Kadıköy Moda Cad. No:12 Daire:4
Açıklama: Mutfak tavanından su sızıntısı, komşu dairesinden kaynaklandığı düşünülüyor.
`.trim();

/** Yerel geliştirme önizlemesi — giriş / DB gerektirmez. */
export default function InboxInsuredModalPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const { draft } = useMemo(
    () =>
      buildInboxFileOpenDraft({
        subject: 'Hasar İhbar / Emin Ali Yiğit / 1234567890 / Su Baskını',
        fromAddress: 'tugce.islek@remed.com',
        fromName: 'Tuğçe İşlek',
        bodyText: REMED_SAMPLE_BODY,
        aiSummary:
          'Remed üzerinden konut hasar ihbarı. Sigortalı Emin Ali Yiğit, su baskını — Kadıköy.',
      }),
    [],
  );

  const [kind, setKind] = useState<'claim' | 'emergency'>('claim');
  const [open, setOpen] = useState(true);
  const [instruction, setInstruction] = useState('Sigortalıyı arayın, eksper atamasını başlatın.');
  const [insuredName, setInsuredName] = useState(draft.insuredName);
  const [insuredPhone, setInsuredPhone] = useState(draft.insuredPhone);
  const [insuredAddress, setInsuredAddress] = useState(draft.insuredAddress);
  const [fileNo, setFileNo] = useState(draft.fileNo);
  const [policyNo, setPolicyNo] = useState(draft.policyNo);
  const [claimNo, setClaimNo] = useState(draft.claimNo);
  const [lossType, setLossType] = useState(draft.lossType);
  const [fileSubject, setFileSubject] = useState(draft.fileSubject);

  return (
    <div className="min-h-screen bg-slate-200/60 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto mb-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <div>
          <p className="text-xs font-medium text-amber-600 mb-1">Yerel Önizleme (Dev Only)</p>
          <h1 className="text-lg font-bold text-slate-800">Gelen Kutusu — Dosya Açma 2.01</h1>
          <p className="text-sm text-slate-500 mt-1">
            Mail şablonu (ihbar konusu, asistan firma, sigorta şirketi, poliçe, referans) +
            sigortalı bilgileri tek modalda.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setKind('claim'); setOpen(true); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${kind === 'claim' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Hasar Aç
          </button>
          <button
            type="button"
            onClick={() => { setKind('emergency'); setOpen(true); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${kind === 'emergency' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Acil Aç
          </button>
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="px-3 py-1.5 rounded-lg text-sm text-brand-600 bg-blue-50"
            >
              Modalı Aç
            </button>
          )}
        </div>
      </div>

      <InboxOpenFileModal
        open={open}
        kind={kind}
        draft={draft}
        instruction={instruction}
        onInstructionChange={setInstruction}
        confirmLabel={kind === 'claim' ? 'Hasar Aç' : 'Acil Aç'}
        loading={false}
        error=""
        routing={{
          customerMatch: { status: 'not_found' },
          warnings: ['Örnek: bölge eşleşmesi yapılamadı'],
        }}
        selectedAssigneeId=""
        onAssigneeChange={() => {}}
        createNewCustomer
        onCreateNewCustomerChange={() => {}}
        insuredName={insuredName}
        onInsuredNameChange={setInsuredName}
        insuredPhone={insuredPhone}
        onInsuredPhoneChange={setInsuredPhone}
        insuredAddress={insuredAddress}
        onInsuredAddressChange={setInsuredAddress}
        fileNo={fileNo}
        onFileNoChange={setFileNo}
        policyNo={policyNo}
        onPolicyNoChange={setPolicyNo}
        claimNo={claimNo}
        onClaimNoChange={setClaimNo}
        lossType={lossType}
        onLossTypeChange={setLossType}
        fileSubject={fileSubject}
        onFileSubjectChange={setFileSubject}
        insuranceCompanies={[{ id: '1', name: 'Türkiye Sigorta' }]}
        insuranceCompanyId="1"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
