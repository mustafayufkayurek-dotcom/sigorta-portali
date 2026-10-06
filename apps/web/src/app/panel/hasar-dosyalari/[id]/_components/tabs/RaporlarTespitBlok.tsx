'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, FileText, ImagePlus, RefreshCw, type LucideIcon } from 'lucide-react';
import { FieldInspectionPhotosPanel } from '@/components/field-survey/FieldInspectionPhotosPanel';
import { SmartMeasureList } from '@/components/smart-measures/SmartMeasureList';
import { IletisimGunluguPanel } from './IletisimGunluguPanel';

const inspectLinkClass =
  'inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700';

function JumpLink({
  icon: Icon,
  label,
  onClick,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={inspectLinkClass} data-testid={testId}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

export function RaporlarTespitBlok({ claimId }: { claimId: string }) {
  const [photosOpen, setPhotosOpen] = useState(false);

  useEffect(() => {
    if (!photosOpen) return;
    document.getElementById('saha-foto')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [photosOpen]);

  const openPhotos = () => setPhotosOpen(true);
  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <RaporlarJumpStrip
        onOlcum={() => jump('raporlar-olcum-tespit')}
        onTespitResimleri={openPhotos}
        onOnarim={() => jump('raporlar-onarim')}
        onRevizyon={() => jump('raporlar-revizyon')}
      />
      <section
        id="raporlar-olcum-tespit"
        className="scroll-mt-16 rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <SmartMeasureList claimFileId={claimId} showEmpty embed />
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
          {photosOpen ? (
            <div id="saha-foto" className="mb-4 scroll-mt-16">
              <div className="mb-3 flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <ImagePlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="pt-1.5 text-sm font-semibold text-slate-800">Tespit Fotoğrafları</h3>
              </div>
              <FieldInspectionPhotosPanel claimId={claimId} />
            </div>
          ) : null}
          <div id="saha-not" className="scroll-mt-16">
            <div className="mb-3 flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <ClipboardList className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="pt-1.5 text-sm font-semibold text-slate-800">Tespit Notları</h3>
            </div>
            <IletisimGunluguPanel claimId={claimId} variant="field" />
          </div>
        </div>
      </section>
    </>
  );
}

export function RaporlarJumpStrip({
  onOlcum,
  onTespitResimleri,
  onOnarim,
  onRevizyon,
}: {
  onOlcum?: () => void;
  onTespitResimleri?: () => void;
  onOnarim?: () => void;
  onRevizyon?: () => void;
}) {
  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <nav
      className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1"
      aria-label="Raporlar bölümleri"
      data-testid="raporlar-atlama"
    >
      <JumpLink
        icon={ClipboardList}
        label="Ölçüm ve tespit"
        onClick={() => onOlcum?.() ?? jump('raporlar-olcum-tespit')}
      />
      <span className="text-slate-300" aria-hidden>
        ·
      </span>
      <JumpLink
        icon={ImagePlus}
        label="Tespit Resimleri"
        onClick={() => onTespitResimleri?.() ?? jump('saha-foto')}
        testId="raporlar-atlama-tespit-resimleri"
      />
      <span className="text-slate-300" aria-hidden>
        ·
      </span>
      <JumpLink
        icon={FileText}
        label="Onarım raporları"
        onClick={() => onOnarim?.() ?? jump('raporlar-onarim')}
      />
      <span className="text-slate-300" aria-hidden>
        ·
      </span>
      <JumpLink
        icon={RefreshCw}
        label="Revizyon"
        onClick={() => onRevizyon?.() ?? jump('raporlar-revizyon')}
      />
    </nav>
  );
}
