'use client';

/** Ortak akış sözlüğü: tamamlandı · sırada · gelecek. */
export type FileStageTone = 'completed' | 'active' | 'future';

export type FileStageStep = {
  key: string;
  label: string;
  tone: FileStageTone;
};

function dotTone(tone: FileStageTone): string {
  if (tone === 'active') return 'border-status-warning bg-status-warning text-slate-950';
  if (tone === 'completed') return 'border-status-success bg-status-success text-white';
  return 'border-slate-300 bg-white text-slate-400';
}

/**
 * Dosya akışı şeridi — Hasar ve Acil tek bileşenden çizer.
 * Başlık çizginin solunda; ilk daire çizginin başında.
 * Adım listesi departmanın kendi akışından gelir; görünüm ortaktır.
 */
export function FileStageStrip({
  steps,
  compact = true,
  showTitle = true,
  title = 'Dosya Akışı',
  className = '',
  testId = 'file-stage-strip',
  trackTestId,
}: {
  steps: FileStageStep[];
  compact?: boolean;
  showTitle?: boolean;
  title?: string;
  className?: string;
  testId?: string;
  /** Kaydırılan şerit gövdesine ek test kimliği (departman kabul senaryoları). */
  trackTestId?: string;
}) {
  const dotSize = compact ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';

  const timeline = (
    <div
      className="min-w-0 flex-1 overflow-x-auto overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-testid={trackTestId}
    >
      <div className="relative flex w-full min-w-[9.5rem] items-center py-0.5 pr-2.5">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <div
              key={step.key}
              className={`flex items-center ${idx === 0 ? 'shrink-0' : 'min-w-0 flex-1'}`}
            >
              {idx > 0 && (
                <div
                  className={`relative z-0 h-0.5 min-w-[0.45rem] flex-1 rounded-full bg-status-danger ${isLast ? 'max-w-[1.15rem]' : ''}`}
                  aria-hidden
                />
              )}
              <div className="relative z-10 flex shrink-0 flex-col items-center" title={step.label}>
                <div
                  className={`flex items-center justify-center rounded-full border-2 font-semibold tabular-nums shadow-sm ring-2 ring-white ${dotSize} ${dotTone(step.tone)}`}
                  aria-current={step.tone === 'active' ? 'step' : undefined}
                >
                  {idx + 1}
                </div>
                {!compact ? (
                  <span className="mt-1.5 max-w-[88px] truncate text-center text-[10px] text-slate-500 whitespace-nowrap">
                    {step.label}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`.trim()} data-testid={testId}>
      {showTitle ? (
        <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-slate-500">
          {title}
        </p>
      ) : null}
      {timeline}
    </div>
  );
}
