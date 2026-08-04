'use client';

import { useState } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import {
  HrPersonnelDocumentsPanel,
  type WorkScope,
} from '@/components/hr/HrPersonnelDocumentsPanel';
import { HrAssignedAssetsPanel } from '@/components/hr/HrAssignedAssetsPanel';

/**
 * Lokal tasarım önizleme — oturum gerektirmez.
 * URL: /dev/personel-ozluk-evrak
 *
 * 1) Özlük evrakları — çalışma tipine göre zorunluluk (Ofis → İSG uygulanmaz)
 * 2) Zimmet kuşbakışı — Admin/Finans Özet Ve Denetim görünümü
 */
export default function PersonelOzlukEvrakPreviewPage() {
  const [workScope, setWorkScope] = useState<WorkScope>('office');
  const [section, setSection] = useState<'docs' | 'assets'>('docs');

  return (
    <ToastProvider>
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-content-tertiary mb-1">
                Geliştirme / Personel Özlük
              </p>
              <h1 className="text-2xl font-bold text-content-primary">
                Özlük Evrakları Ve Zimmet — Tasarım Önizleme
              </h1>
              <p className="text-sm text-content-secondary mt-1 max-w-2xl">
                Evrak zorunluluğu çalışma tipine göre (Ofis / Saha / Riskli İş).
                Zimmetli demirbaşlar Admin ve Finans kuşbakışında. Örnek veri —
                API henüz bağlı değil.
              </p>
            </div>
            <span className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
              Local Önizleme
            </span>
          </div>

          <div className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-content-secondary space-y-1">
            <p className="font-semibold text-content-primary">Kural (Önerilen Model)</p>
            <p>
              Ayarlar → Personel: her evrak için kapsam (Tüm / Ofis / Saha / Riskli) + seviye
              (Zorunlu / Koşullu / Önerilen). Personel kartında çalışma tipi seçilir; eksik
              sayacı yalnız o personele uygulanan zorunlu evraklardan hesaplanır. Örnek: İsg
              ve saha sağlık raporu ofiste &quot;Uygulanmaz&quot;.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSection('docs')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                section === 'docs'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-border text-content-secondary hover:bg-slate-50'
              }`}
            >
              1) Özlük Evrakları
            </button>
            <button
              type="button"
              onClick={() => setSection('assets')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                section === 'assets'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-border text-content-secondary hover:bg-slate-50'
              }`}
            >
              2) Zimmet Kuşbakışı (Özet Ve Denetim)
            </button>
          </div>

          {section === 'docs' ? (
            <HrPersonnelDocumentsPanel
              preview
              workScope={workScope}
              onWorkScopeChange={setWorkScope}
              employeeName={
                workScope === 'office'
                  ? 'Ayşe Yılmaz (Ofis)'
                  : workScope === 'field'
                    ? 'Mehmet Kara (Saha)'
                    : 'Ali Demir (Riskli İş)'
              }
            />
          ) : (
            <div className="space-y-6">
              <HrAssignedAssetsPanel preview />
              <div className="rounded-xl border border-dashed border-border bg-white p-4 text-xs text-content-tertiary">
                Canlıda bu blok Özet Ve Denetim sekmesinin altına gelir. Personel özlük
                dosyasında da aynı personelin zimmet listesi görünür. Demirbaş kaydı mevcut
                <span className="font-medium text-content-secondary"> fixed_assets </span>
                tablosuna yazılır (kategori, ad/marka-model, seri no, zimmetli personel) —
                şema değişikliği gerekmez.
              </div>
            </div>
          )}
        </div>
      </main>
    </ToastProvider>
  );
}
