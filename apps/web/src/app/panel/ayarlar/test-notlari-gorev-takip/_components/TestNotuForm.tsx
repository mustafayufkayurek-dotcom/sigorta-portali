'use client';

import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { API, authHeader } from '@/utils/api';
import { TEST_NOTE_PRIORITIES, TEST_NOTE_STATUSES, TestNote } from '../_lib/api';

type Props = {
  initial?: TestNote | null;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
};

export function TestNotuForm({ initial, onCancel, onSubmit, saving }: Props) {
  const [ekranModul, setEkranModul] = useState(initial?.ekranModul ?? '');
  const [kullaniciGozlemi, setKullaniciGozlemi] = useState(initial?.kullaniciGozlemi ?? '');
  const [beklenenDavranis, setBeklenenDavranis] = useState(initial?.beklenenDavranis ?? '');
  const [oncelik, setOncelik] = useState<string>(initial?.oncelik ?? 'P2');
  const [durum, setDurum] = useState<string>(initial?.durum ?? 'YENI');
  const [tekrarDurumu, setTekrarDurumu] = useState(initial?.tekrarDurumu ?? false);
  const [isArchived, setIsArchived] = useState(initial?.isArchived ?? false);
  const [managerIslemNotu, setManagerIslemNotu] = useState(initial?.managerIslemNotu ?? '');
  const [ekranGoruntusu, setEkranGoruntusu] = useState(initial?.ekranGoruntusu ?? '');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadError, setUploadError] = useState('');

  const canSubmit = useMemo(() => !saving && !uploading, [saving, uploading]);

  useEffect(() => {
    setEkranModul(initial?.ekranModul ?? '');
    setKullaniciGozlemi(initial?.kullaniciGozlemi ?? '');
    setBeklenenDavranis(initial?.beklenenDavranis ?? '');
    setOncelik(initial?.oncelik ?? 'P2');
    setDurum(initial?.durum ?? 'YENI');
    setTekrarDurumu(initial?.tekrarDurumu ?? false);
    setIsArchived(initial?.isArchived ?? false);
    setManagerIslemNotu(initial?.managerIslemNotu ?? '');
    setEkranGoruntusu(initial?.ekranGoruntusu ?? '');
  }, [initial?.id]);

  useEffect(() => {
    if (durum === 'KABUL') {
      setIsArchived(true);
    }
  }, [durum]);

  useEffect(() => {
    let active = true;
    const loadSignedUrl = async () => {
      if (!ekranGoruntusu) {
        setPreviewUrl('');
        return;
      }
      try {
        const res = await axios.get(`${API}/uploads/signed-url`, {
          params: { storageKey: ekranGoruntusu },
          headers: authHeader(),
        });
        if (active) {
          setPreviewUrl(res.data?.url ?? '');
        }
      } catch {
        if (active) {
          setPreviewUrl('');
        }
      }
    };
    loadSignedUrl();
    return () => { active = false; };
  }, [ekranGoruntusu]);

  const handleFileUpload = async (file: File) => {
    setUploadError('');
    setUploading(true);
    try {
      const presignRes = await axios.post(
        `${API}/uploads/presign`,
        { folder: 'test-notes', fileName: file.name, contentType: file.type || 'application/octet-stream' },
        { headers: authHeader() },
      );
      const presignedUrl = String(presignRes.data?.presignedUrl ?? '');
      const storageKey = String(presignRes.data?.storageKey ?? '');
      if (!presignedUrl || !storageKey) {
        throw new Error('Presign yanıtı geçersiz.');
      }

      await axios.put(presignedUrl, file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      setEkranGoruntusu(storageKey);
    } catch (e: any) {
      setUploadError(e.response?.data?.message ?? e.message ?? 'Dosya yükleme başarısız.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    await onSubmit({
      ekranModul,
      kullaniciGozlemi,
      beklenenDavranis,
      ekranGoruntusu: ekranGoruntusu || undefined,
      oncelik,
      durum,
      tekrarDurumu,
      isArchived,
      managerIslemNotu: managerIslemNotu || undefined,
    });
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      encType="multipart/form-data"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Ekran / Modül</label>
          <input value={ekranModul} onChange={(e) => setEkranModul(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Ekran Görüntüsü (Storage Key)</label>
          <input name="ekranGoruntusu" value={ekranGoruntusu} onChange={(e) => setEkranGoruntusu(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Ekran Görüntüsü Yükle</label>
        <input
          type="file"
          name="ekranGoruntusuFile"
          accept="image/*,.pdf"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="mt-1 text-[10px] text-slate-400">Seçilen dosya güvenli olarak yüklenecek ve storage key alanı otomatik doldurulacaktır.</div>
        {uploading && <div className="mt-1 text-xs text-blue-600">Yükleniyor...</div>}
        {uploadError && <div className="mt-1 text-xs text-red-600">{uploadError}</div>}
        {previewUrl && (
          <div className="mt-2">
            {/\.(pdf)(\?|$)/i.test(previewUrl) ? (
              <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Kanıt dosyasını görüntüle</a>
            ) : (
              <a href={previewUrl} target="_blank" rel="noreferrer">
                <img src={previewUrl} alt="Kanıt önizleme" className="h-24 w-auto rounded border border-slate-200 object-cover" />
              </a>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Öncelik</label>
          <select value={oncelik} onChange={(e) => setOncelik(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {TEST_NOTE_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Durum</label>
          <select value={durum} onChange={(e) => setDurum(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {TEST_NOTE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {durum === 'KABUL' && (
            <div className="mt-1 text-[11px] font-medium text-emerald-700">
              Kabul seçildiğinde not kapanır ve açık test listesinde görünmez.
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Kullanıcı Gözlemi</label>
        <textarea value={kullaniciGozlemi} onChange={(e) => setKullaniciGozlemi(e.target.value)} className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Beklenen Davranış</label>
        <textarea value={beklenenDavranis} onChange={(e) => setBeklenenDavranis(e.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Yapılan İşlem (Manager Notu)</label>
        <textarea value={managerIslemNotu} onChange={(e) => setManagerIslemNotu(e.target.value)} placeholder="Bu nota dair ne yapıldı? Örn: 'Logo boyutu düzeltildi, yeni sekme davranışı eklendi, canlıya alındı.'" className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        {initial?.islemTarihi && <div className="mt-1 text-[10px] text-slate-400">Son işlem: {new Date(initial.islemTarihi).toLocaleString('tr-TR')}</div>}
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={tekrarDurumu} onChange={(e) => setTekrarDurumu(e.target.checked)} />
          Tekrar durumu var
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={isArchived} disabled={durum === 'KABUL'} onChange={(e) => setIsArchived(e.target.checked)} />
          Arşivde
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={uploading} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">İptal</button>
        <button type="submit" disabled={!canSubmit} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Kaydediliyor...' : uploading ? 'Yükleniyor...' : initial ? 'Güncelle' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}
