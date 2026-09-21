/**
 * Hasar onarım raporu PDF önizlemesi.
 * Edge/Chrome, blob adresini `noopener` ile açınca hata fırlatır;
 * personel «PDF önizleme açılamadı» görür, rapor aslında gelmiştir.
 * Yeni pencere kesilirse aynı sayfada önizleme durur.
 */

const PANEL_ID = 'hasar-pdf-onizleme';

let detachPreview: (() => void) | null = null;

type WindowOpener = (url: string, target: string) => Window | null;

export async function readPdfPreviewFailure(blob: Blob, contentType: string): Promise<string | null> {
  const type = contentType.toLowerCase();
  const head = await blob.slice(0, 5).text();
  if (type.includes('pdf') || head.startsWith('%PDF')) return null;

  let message = 'PDF önizleme açılamadı.';
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as { message?: string | string[] };
    const raw = parsed.message;
    if (typeof raw === 'string' && raw.trim()) message = raw;
    else if (Array.isArray(raw) && raw[0]) message = String(raw[0]);
  } catch {
    /* gövde JSON değil */
  }
  return message;
}

/** Üçüncü argüman (noopener) verilmez; blob adresi o yüzden kırılıyordu. */
export function openBlobUrlWithoutNoopener(
  url: string,
  opener: WindowOpener = (targetUrl, target) => window.open(targetUrl, target),
): Window | null {
  try {
    const opened = opener(url, '_blank');
    if (opened) {
      try {
        opened.opener = null;
      } catch {
        /* pencere yine açık */
      }
    }
    return opened ?? null;
  } catch {
    return null;
  }
}

function mountPdfPreviewPanel(url: string, title: string, print = false) {
  detachPreview?.();

  const root = document.createElement('div');
  root.id = PANEL_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:rgba(15,23,42,.45)',
    'z-index:90',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:16px',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#fff',
    'border-radius:16px',
    'width:min(1100px,100%)',
    'height:min(92vh,100%)',
    'display:flex',
    'flex-direction:column',
    'overflow:hidden',
    'box-shadow:0 20px 50px rgba(15,23,42,.25)',
  ].join(';');

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #e2e8f0;';

  const heading = document.createElement('h2');
  heading.textContent = title;
  heading.style.cssText = 'margin:0;font-size:14px;font-weight:600;color:#1e293b;';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Kapat';
  close.style.cssText = 'border:1px solid #e2e8f0;background:#fff;color:#475569;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;';

  const frame = document.createElement('iframe');
  frame.title = title;
  frame.src = url;
  frame.style.cssText = 'flex:1;width:100%;border:0;background:#f8fafc;';

  function detach() {
    document.removeEventListener('keydown', onKey);
    root.remove();
    URL.revokeObjectURL(url);
    if (detachPreview === detach) detachPreview = null;
  }
  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') detach();
  }
  detachPreview = detach;

  document.addEventListener('keydown', onKey);
  close.addEventListener('click', detach);
  root.addEventListener('click', (event) => {
    if (event.target === root) detach();
  });

  if (print) {
    frame.addEventListener('load', () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        /* yazdırma kesildi */
      }
    });
  }

  bar.append(heading, close);
  card.append(bar, frame);
  root.append(card);
  document.body.append(root);
}

function presentBlobUrl(url: string, title: string, print: boolean): 'tab' | 'panel' | null {
  const tab = openBlobUrlWithoutNoopener(url);
  if (tab) {
    if (print) {
      const runPrint = () => {
        try {
          tab.focus();
          tab.print();
        } catch {
          /* yazdırma kesildi */
        }
      };
      tab.addEventListener('load', runPrint);
      window.setTimeout(runPrint, 500);
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return 'tab';
  }
  if (typeof document === 'undefined') {
    URL.revokeObjectURL(url);
    return null;
  }
  mountPdfPreviewPanel(url, title, print);
  return 'panel';
}

/** Oturumla gelen dosya. Yeni pencere kesilirse aynı sayfada durur. */
export async function openSessionBlob(
  blob: Blob,
  title: string,
  opts?: { print?: boolean },
): Promise<'tab' | 'panel' | null> {
  const url = URL.createObjectURL(blob);
  return presentBlobUrl(url, title, Boolean(opts?.print));
}

export async function presentPdfPreview(blob: Blob, title: string): Promise<'tab' | 'panel' | null> {
  const pdfBlob = new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
  const url = URL.createObjectURL(pdfBlob);
  return presentBlobUrl(url, title, false);
}
