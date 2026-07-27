'use client';

import { TestNote, TestNoteFormat } from '../_lib/api';

type Props = {
  selected: TestNote | null;
  format: TestNoteFormat | null;
  onGenerate: () => void;
  loading: boolean;
};

export function DanismanFormatiTab({ selected, format, onGenerate, loading }: Props) {
  if (!selected) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">Danışman formatı üretmek için Test Notları sekmesinden bir kayıt seçin.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-600">{selected.testNo}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{selected.ekranModul}</h3>
            <p className="mt-2 text-sm text-slate-600">{selected.kullaniciGozlemi}</p>
          </div>
          <button onClick={onGenerate} disabled={loading} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? 'Üretiliyor...' : 'Format Üret'}
          </button>
        </div>
      </div>
      {format ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['Sorun Özeti', format.sorunOzeti],
            ['Beklenen Davranış', format.beklenenDavranis],
            ['Etki Sınıfı', format.etkiSinifi],
            ['Öncelik', format.oncelik],
            ['Mühendislik Talimatı', format.muhendislikTalimati],
            ['Kabul Kriteri', format.kabulKriteri],
            ['Kanıt Beklentisi', format.kanitBeklentisi],
            ['Onay', format.onayli ? 'Onaylı' : 'Onaysız öneri'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold tracking-wide text-slate-400">{label}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">Henüz üretilmiş danışman formatı yok.</div>
      )}
    </div>
  );
}