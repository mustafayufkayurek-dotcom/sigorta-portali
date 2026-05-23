'use client';

import { TestNote } from '../_lib/api';

type Props = {
  items: TestNote[];
  onSelect: (item: TestNote) => void;
  onEdit: (item: TestNote) => void;
  onDelete: (item: TestNote) => void;
  selectedId?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TestNotlariTab({ items, onSelect, onEdit, onDelete, selectedId }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-500">Test No</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-500">Modül</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-500">Öncelik</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-500">Durum</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-500">Yapılan İşlem</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-500">Oluşturan</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-500">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>Kayıt bulunamadı.</td></tr>
            ) : items.map((item) => {
              const hasIslem = !!item.managerIslemNotu;
              return (
                <tr key={item.id} className={selectedId === item.id ? 'bg-blue-50' : 'border-t border-slate-100'}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.testNo}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <button onClick={() => onSelect(item)} className="text-left hover:text-blue-700">
                      <div className="font-medium">{item.ekranModul}</div>
                      <div className="line-clamp-2 text-xs text-slate-500">{item.kullaniciGozlemi}</div>
                      {item.ekranGoruntusu && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            📷 Görüntü var
                          </span>
                        </div>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.oncelik}</td>
                  <td className="px-4 py-3 text-slate-700">{item.durum}</td>
                  <td className="px-4 py-3">
                    {hasIslem ? (
                      <div className="flex flex-col gap-1 max-w-xs">
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">YAPILDI</span>
                        <div className="text-xs text-slate-600 line-clamp-3">{item.managerIslemNotu}</div>
                        {item.islemTarihi && <div className="text-[10px] text-slate-400">{formatDate(item.islemTarihi)}</div>}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">BEKLİYOR</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.createdBy.firstName} {item.createdBy.lastName}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(item)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600">Düzenle</button>
                      <button onClick={() => onDelete(item)} className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600">Sil</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
