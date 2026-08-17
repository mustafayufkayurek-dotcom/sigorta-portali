'use client';

import { useState, useRef } from 'react';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import Link from 'next/link';
import { API, authHeader } from '@/utils/api';

type ImportResult = {
  created: number;
  updated: number;
  total: number;
  errors: Array<{ row: number; message: string }>;
};

export default function FiyatListesiYuklePage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const valid = f.name.endsWith('.xlsx') || f.name.endsWith('.xls');
    if (!valid) { setError('Sadece .xlsx veya .xls formatında dosya kabul edilir.'); return; }
    setFile(f); setError(''); setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) { setError('Lütfen bir Excel dosyası seçin.'); return; }
    setUploading(true); setError(''); setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/work-groups/import-excel`, {
        method: 'POST',
        headers: authHeader(),
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Yükleme başarısız');
      setResult(json.data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (e: any) {
      setError(e.message ?? 'Yükleme sırasında hata oluştu');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SettingsPageLayout
      title="Fiyat Listesi — Excel ile Yükle"
      description="Excel dosyanızdan toplu iş grubu ve alt grup fiyatları yükleyin."
      headerExtra={
        <Link
          href="/panel/ayarlar/fiyat-listesi"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >

          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Fiyat Listesine Dön
        </Link>
      }
    >
      <div className="max-w-2xl space-y-6">
        {/* Format Bilgisi */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Excel Dosya Formatı</h3>
          <p className="text-xs text-blue-700 mb-3">Dosyanızın ilk satırı başlık satırı olarak atlanır. Sütun sırası:</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-blue-100 text-blue-800">
                  <th className="px-3 py-1.5 text-center font-medium rounded-l-lg">Sütun A</th>
                  <th className="px-3 py-1.5 text-center font-medium">Sütun B</th>
                  <th className="px-3 py-1.5 text-center font-medium">Sütun C</th>
                  <th className="px-3 py-1.5 text-center font-medium rounded-r-lg">Sütun D</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white/60">
                  <td className="px-3 py-1.5 text-blue-700 font-medium">İş Grubu Adı*</td>
                  <td className="px-3 py-1.5 text-blue-700 font-medium">Alt Grup Adı*</td>
                  <td className="px-3 py-1.5 text-blue-700">Birim (adet, m², metre, saat, kg, ton)</td>
                  <td className="px-3 py-1.5 text-blue-700">Birim Fiyat (TL)</td>
                </tr>
                <tr className="bg-white/40 text-brand-600/80 italic">
                  <td className="px-3 py-1.5">Tesisat</td>
                  <td className="px-3 py-1.5">Musluk Değişimi</td>
                  <td className="px-3 py-1.5">adet</td>
                  <td className="px-3 py-1.5">350</td>
                </tr>
                <tr className="bg-white/40 text-brand-600/80 italic">
                  <td className="px-3 py-1.5">Boya</td>
                  <td className="px-3 py-1.5">İç Duvar Boyası</td>
                  <td className="px-3 py-1.5">m²</td>
                  <td className="px-3 py-1.5">75</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-brand-600 mt-2">
            * Zorunlu alan. Mevcut alt gruplar güncellenir, yeniler eklenir.
          </p>
        </div>

        {/* Yükleme Alanı */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = ''; }}
                className="text-xs text-status-danger hover:text-red-700 mt-1"
              >
                Dosyayı Kaldır
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Excel dosyasını buraya sürükleyin</p>
                <p className="text-xs text-slate-400 mt-0.5">veya tıklayarak seçin (.xlsx, .xls)</p>
              </div>
            </div>
          )}
        </div>

        {/* Hata */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Yükle Butonu */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Yükleniyor...
            </span>
          ) : 'Excel Dosyasını Yükle'}
        </button>

        {/* Sonuç */}
        {result && (
          <div className={`rounded-2xl border p-5 ${result.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${result.errors.length === 0 ? 'text-green-800' : 'text-amber-800'}`}>
              Yükleme Tamamlandı
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/60 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{result.created}</p>
                <p className="text-xs text-slate-500 mt-0.5">Eklendi</p>
              </div>
              <div className="bg-white/60 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-brand-600">{result.updated}</p>
                <p className="text-xs text-slate-500 mt-0.5">Güncellendi</p>
              </div>
              <div className="bg-white/60 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-600">{result.total}</p>
                <p className="text-xs text-slate-500 mt-0.5">Toplam Satır</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-2">{result.errors.length} satırda hata:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-white/60 rounded-lg px-2.5 py-1.5">
                      <span className="font-mono font-semibold shrink-0">Satır {err.row}:</span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.errors.length === 0 && (
              <p className="text-xs text-green-700">Tüm satırlar başarıyla işlendi.</p>
            )}

            <Link href="/panel/ayarlar/fiyat-listesi" className="inline-block mt-3 text-xs text-brand-600 hover:underline font-medium">
              Fiyat listesini görüntüle →
            </Link>
          </div>
        )}
      </div>
    </SettingsPageLayout>
  );
}
