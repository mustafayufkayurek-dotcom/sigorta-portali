'use client';

import { Fragment, useState } from 'react';
import { TestNote } from '../_lib/api';
import { TestNotuForm } from './TestNotuForm';

type Props = {
  items: TestNote[];
  selectedId?: string | null;
  onSelect: (item: TestNote) => void;
  onEdit: (item: TestNote, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (item: TestNote) => void;
  saving?: boolean;
};

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TestNotlariTab({ items, selectedId, onSelect, onEdit, onDelete, saving }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 p-3 md:hidden">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">Kayıt bulunamadı.</div>
        ) : items.map((item) => {
          const hasIslem = !!item.managerIslemNotu;
          const isEditing = editingId === item.id;
          return (
            <div
              key={item.id}
              id={`testnotu-mobile-row-${item.id}`}
              className={`rounded-2xl border p-4 ${selectedId === item.id ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}
            >
              <button onClick={() => onSelect(item)} className="block w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{item.testNo}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">{item.ekranModul}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{item.durum}</span>
                </div>
                <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">{item.kullaniciGozlemi}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{item.oncelik}</span>
                  {item.ekranGoruntusu && (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">Görüntü var</span>
                  )}
                  {hasIslem ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">Yapılan işlem var</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">Bekliyor</span>
                  )}
                </div>
              </button>
              {hasIslem && (
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  {item.managerIslemNotu}
                  {item.islemTarihi && <div className="mt-1 text-[10px] text-slate-400">{formatDate(item.islemTarihi)}</div>}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setEditingId(isEditing ? null : item.id);
                    if (!isEditing) {
                      setTimeout(() => {
                        const row = document.getElementById(`testnotu-mobile-row-${item.id}`);
                        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }
                  }}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                >
                  {isEditing ? 'Kapat' : 'Düzenle'}
                </button>
                <button onClick={() => onDelete(item)} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Sil</button>
              </div>
              {isEditing && (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/50 p-3">
                  <div className="mb-2 text-xs font-semibold text-blue-700">{item.testNo} — Düzenleme</div>
                  <TestNotuForm
                    initial={item}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (payload) => {
                      await onEdit(item, payload);
                      setEditingId(null);
                    }}
                    saving={Boolean(saving)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
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
              const isEditing = editingId === item.id;
              return (
                <Fragment key={item.id}>
                  <tr id={`testnotu-row-${item.id}`} className={selectedId === item.id ? 'bg-blue-50' : 'border-t border-slate-100'}>
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
                        <button
                          onClick={() => {
                            setEditingId(isEditing ? null : item.id);
                            if (!isEditing) {
                              setTimeout(() => {
                                const row = document.getElementById(`testnotu-row-${item.id}`);
                                if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }, 100);
                            }
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
                        >
                          {isEditing ? 'Kapat' : 'Düzenle'}
                        </button>
                        <button onClick={() => onDelete(item)} className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600">Sil</button>
                      </div>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="border-t border-blue-200 bg-blue-50/30">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="mb-2 text-xs font-semibold text-blue-700">
                          {item.testNo} — Düzenleme
                        </div>
                        <TestNotuForm
                          initial={item}
                          onCancel={() => setEditingId(null)}
                          onSubmit={async (payload) => {
                            await onEdit(item, payload);
                            setEditingId(null);
                          }}
                          saving={Boolean(saving)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
