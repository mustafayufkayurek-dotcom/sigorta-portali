'use client';

import { TEST_NOTE_PRIORITIES, TEST_NOTE_STATUSES, TestNote } from '../_lib/api';

type Props = {
  initial?: TestNote | null;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
};

export function TestNotuForm({ initial, onCancel, onSubmit, saving }: Props) {
  const submit = async (formData: FormData) => {
    await onSubmit({
      ekranModul: String(formData.get('ekranModul') ?? ''),
      kullaniciGozlemi: String(formData.get('kullaniciGozlemi') ?? ''),
      beklenenDavranis: String(formData.get('beklenenDavranis') ?? ''),
      ekranGoruntusu: String(formData.get('ekranGoruntusu') ?? '') || undefined,
      oncelik: String(formData.get('oncelik') ?? 'P2'),
      durum: String(formData.get('durum') ?? 'YENI'),
      tekrarDurumu: formData.get('tekrarDurumu') === 'on',
      isArchived: formData.get('isArchived') === 'on',
      managerIslemNotu: String(formData.get('managerIslemNotu') ?? '') || undefined,
    });
  };

  return (
    <form
      action={submit}
      encType="multipart/form-data"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Ekran / Modül</label>
          <input name="ekranModul" defaultValue={initial?.ekranModul ?? ''} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Ekran Görüntüsü URL</label>
          <input name="ekranGoruntusu" defaultValue={initial?.ekranGoruntusu ?? ''} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Ekran Görüntüsü Yükle</label>
        <input type="file" name="ekranGoruntusuFile" accept="image/*" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100" />
        <div className="mt-1 text-[10px] text-slate-400">Resim dosyası yüklendiğinde URL alanı otomatik doldurulacaktır.</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Öncelik</label>
          <select name="oncelik" defaultValue={initial?.oncelik ?? 'P2'} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {TEST_NOTE_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Durum</label>
          <select name="durum" defaultValue={initial?.durum ?? 'YENI'} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {TEST_NOTE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Kullanıcı Gözlemi</label>
        <textarea name="kullaniciGozlemi" defaultValue={initial?.kullaniciGozlemi ?? ''} className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Beklenen Davranış</label>
        <textarea name="beklenenDavranis" defaultValue={initial?.beklenenDavranis ?? ''} className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Yapılan İşlem (Manager Notu)</label>
        <textarea name="managerIslemNotu" defaultValue={initial?.managerIslemNotu ?? ''} placeholder="Bu nota dair ne yapıldı? Örn: 'Logo boyutu düzeltildi, yeni sekme davranışı eklendi, canlıya alındı.'" className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        {initial?.islemTarihi && <div className="mt-1 text-[10px] text-slate-400">Son işlem: {new Date(initial.islemTarihi).toLocaleString('tr-TR')}</div>}
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="tekrarDurumu" defaultChecked={initial?.tekrarDurumu ?? false} />
          Tekrar durumu var
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="isArchived" defaultChecked={initial?.isArchived ?? false} />
          Arşivde
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">İptal</button>
        <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Kaydediliyor...' : initial ? 'Güncelle' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}