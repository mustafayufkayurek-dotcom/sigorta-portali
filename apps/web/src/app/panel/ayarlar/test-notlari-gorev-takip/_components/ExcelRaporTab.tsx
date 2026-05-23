'use client';

type Props = {
  onDownloadAll: () => void;
  onDownloadWorkItems: () => void;
  loading: boolean;
};

export function ExcelRaporTab({ onDownloadAll, onDownloadWorkItems, loading }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Birleşik Excel</h3>
        <p className="mt-2 text-sm text-slate-600">4 sheet içeren raporu indir: Test Notları, İşler/Kararlar, Danışman Formatı, Durum Özeti.</p>
        <button onClick={onDownloadAll} disabled={loading} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? 'Hazırlanıyor...' : 'Birleşik Excel İndir'}
        </button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">İş / Karar Excel</h3>
        <p className="mt-2 text-sm text-slate-600">Geçici görev ve karar kayıtlarını ayrı Excel çıktısı olarak indir.</p>
        <button onClick={onDownloadWorkItems} disabled={loading} className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? 'Hazırlanıyor...' : 'İşler Excel İndir'}
        </button>
      </div>
    </div>
  );
}