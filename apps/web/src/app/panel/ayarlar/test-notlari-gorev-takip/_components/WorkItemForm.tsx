'use client';

import { useState } from 'react';
import { UserSummary, WORK_ITEM_SOURCES, WORK_ITEM_STATUSES, TEST_NOTE_PRIORITIES, WorkItem } from '../_lib/api';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { normalizeTrDateValue } from '@/utils/tr-date-input';

type Props = {
  initial?: WorkItem | null;
  users: UserSummary[];
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
};

export function WorkItemForm({ initial, users, onCancel, onSubmit, saving }: Props) {
  const [hedefTarih, setHedefTarih] = useState(initial?.hedefTarih?.slice(0, 10) ?? '');
  const [hatirlatmaTarih, setHatirlatmaTarih] = useState(initial?.hatirlatmaTarih?.slice(0, 10) ?? '');

  const submit = async (formData: FormData) => {
    const sorumluId = String(formData.get('sorumluId') ?? '');
    await onSubmit({
      konu: String(formData.get('konu') ?? ''),
      kaynak: String(formData.get('kaynak') ?? 'TEKNIK'),
      oncelik: String(formData.get('oncelik') ?? 'P2'),
      sorumluId: sorumluId || null,
      hedefTarih: normalizeTrDateValue(hedefTarih) || null,
      hatirlatmaTarih: normalizeTrDateValue(hatirlatmaTarih) || null,
      durum: String(formData.get('durum') ?? 'ACIK'),
      kullaniciYorumu: String(formData.get('kullaniciYorumu') ?? '') || null,
      kanit: String(formData.get('kanit') ?? '') || null,
      kapanisNotu: String(formData.get('kapanisNotu') ?? '') || null,
      managerIslemNotu: String(formData.get('managerIslemNotu') ?? '') || null,
      isArchived: formData.get('isArchived') === 'on',
    });
  };

  return (
    <form action={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Konu</label>
          <input name="konu" defaultValue={initial?.konu ?? ''} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Sorumlu</label>
          <select name="sorumluId" defaultValue={initial?.sorumluId ?? ''} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Atanmadı</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Kaynak</label>
          <select name="kaynak" defaultValue={initial?.kaynak ?? 'TEKNIK'} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {WORK_ITEM_SOURCES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Öncelik</label>
          <select name="oncelik" defaultValue={initial?.oncelik ?? 'P2'} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {TEST_NOTE_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Durum</label>
          <select name="durum" defaultValue={initial?.durum ?? 'ACIK'} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {WORK_ITEM_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <label className="inline-flex items-center gap-2 self-end text-sm text-slate-600">
          <input type="checkbox" name="isArchived" defaultChecked={initial?.isArchived ?? false} />
          Arşivde
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Hedef Tarih</label>
          <TrDateInput value={hedefTarih} onChange={setHedefTarih} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Hatırlatma Tarihi</label>
          <TrDateInput value={hatirlatmaTarih} onChange={setHatirlatmaTarih} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Kullanıcı Yorumu</label>
        <textarea name="kullaniciYorumu" defaultValue={initial?.kullaniciYorumu ?? ''} className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Kanıt</label>
          <textarea name="kanit" defaultValue={initial?.kanit ?? ''} className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Kapanış Notu</label>
          <textarea name="kapanisNotu" defaultValue={initial?.kapanisNotu ?? ''} className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Yapılan İşlem (Manager Notu)</label>
        <textarea name="managerIslemNotu" defaultValue={initial?.managerIslemNotu ?? ''} placeholder="Bu iş için ne yapıldı? Örn: 'Soft delete tasarımı hazırlandı, onay bekleniyor.'" className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        {initial?.islemTarihi && <div className="mt-1 text-[10px] text-slate-400">Son işlem: {new Date(initial.islemTarihi).toLocaleString('tr-TR')}</div>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">İptal</button>
        <button type="submit" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Kaydediliyor...' : initial ? 'Güncelle' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}