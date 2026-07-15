'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type OperationRowActionsProps = {
  kind: 'hasar' | 'acil';
  id: string;
  fileNo: string;
  approval72hExceeded?: boolean;
  onNote?: () => void;
  onDeleteRequest?: () => void;
  onMail?: () => void;
};

export function OperationRowActions({
  kind,
  id,
  fileNo,
  approval72hExceeded,
  onNote,
  onDeleteRequest,
  onMail,
}: OperationRowActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const detailHref =
    kind === 'hasar' ? `/panel/hasar-dosyalari/${id}` : `/panel/acil-yardim/${id}`;
  const editHref =
    kind === 'hasar' ? `/panel/hasar-dosyalari/${id}?edit=1` : `/panel/acil-yardim/${id}?edit=1`;

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const waHref = `https://wa.me/?text=${encodeURIComponent(`Meridyen — Dosya: ${fileNo}`)}`;

  return (
    <div ref={ref} className="relative flex items-center gap-0.5" onClick={stop}>
      {approval72hExceeded && (
        <button
          type="button"
          title="Onay Talep Et"
          className="px-1.5 py-1 rounded-md text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
          onClick={() => router.push(`${detailHref}?aksiyon=onay-talep`)}
        >
          Onay Talep Et
        </button>
      )}
      <button
        type="button"
        title="Görüntüle"
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600"
        onClick={() => router.push(detailHref)}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      </button>
      <button
        type="button"
        title="Düzenle"
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600"
        onClick={() => router.push(editHref)}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>
      <button
        type="button"
        title="Not"
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600"
        onClick={() => {
          if (onNote) onNote();
          else router.push(`${detailHref}?tab=notlar`);
        }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      </button>
      <button
        type="button"
        title="Mail"
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600"
        onClick={() => {
          if (onMail) onMail();
          else window.location.href = `mailto:?subject=${encodeURIComponent(`Dosya ${fileNo}`)}`;
        }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
      </button>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp"
        className="p-1.5 rounded-md text-slate-500 hover:bg-green-50 hover:text-green-600"
        onClick={stop}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
      </a>
      <button
        type="button"
        title="İşlem Menüsü"
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-xl border border-slate-200 bg-white shadow-lg py-1 text-xs">
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700"
            onClick={() => {
              setOpen(false);
              router.push(detailHref);
            }}
          >
            Dosyaya Git
          </button>
          {kind === 'hasar' && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700"
              onClick={() => {
                setOpen(false);
                router.push(`/panel/hasar-dosyalari/${id}/onarim-raporu`);
              }}
            >
              Onarım Raporu
            </button>
          )}
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-700"
            onClick={() => {
              setOpen(false);
              onDeleteRequest?.();
            }}
          >
            Sil / İptal…
          </button>
        </div>
      )}
    </div>
  );
}
