/** Açık dosya pinleri — kapalı durağan, açık nabız verir. Panel haritası ile aynı kutu. */

export const HARITA_PIN_SIGNAL_CLASS = 'harita-pin-sinyal';

const STYLE_ID = 'harita-pin-sinyal-css';

export function ensureHaritaPinSignalCss(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes harita-pin-sinyal {
      0%, 100% { transform: scale(1); filter: brightness(1); }
      50% { transform: scale(1.12); filter: brightness(1.15); }
    }
    .${HARITA_PIN_SIGNAL_CLASS} {
      animation: harita-pin-sinyal 1.35s ease-in-out infinite;
      transform-origin: center center;
    }
    .leaflet-div-icon.harita-dosya-pin {
      background: transparent !important;
      border: none !important;
      overflow: visible !important;
    }
  `;
  document.head.appendChild(style);
}

export function escHaritaHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

export function buildPanelFileMarkerHtml(opts: {
  letter: string;
  color: string;
  label: string;
  stage?: string;
  signal?: boolean;
}): string {
  const letter = escHaritaHtml(opts.letter);
  const label = escHaritaHtml(opts.label);
  const stage = opts.stage ? escHaritaHtml(opts.stage) : '';
  const signal = opts.signal ? HARITA_PIN_SIGNAL_CLASS : '';
  return `
      <div class="relative flex flex-col items-center">
        <div class="${signal}" style="min-width:42px;height:36px;border-radius:8px;background:${opts.color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;padding:0 7px;">
          ${letter}
        </div>
        <div class="mt-1 max-w-[10rem] truncate whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 shadow">${label}</div>
        ${stage ? `<div class="mt-0.5 whitespace-nowrap rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">${stage}</div>` : ''}
      </div>`;
}
