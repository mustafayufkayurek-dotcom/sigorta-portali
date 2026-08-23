'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FileSpreadsheet, Trash2 } from 'lucide-react';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { SlidePanel } from '@/components/SlidePanel';
import { OnlineCollectionLinksPanel } from '@/components/finance/OnlineCollectionLinksPanel';
import { canDeleteClaimFinance } from '@/components/finance/can-delete-claim-finance';
import {
  FinansEmptyState,
  FinansFieldLabel,
  FinansFormSection,
  FinansKpiStrip,
  FinansPanelCard,
  finansFileInputClass,
  finansInputClass,
} from '@/components/finance/FinansPanelUI';
import { useToast } from '@/contexts/ToastContext';
import { API, authHeader, fmtCurrency, fmtDate } from '@/app/panel/hasar-dosyalari/[id]/_components/claim-detail-utils';
import { withAvansNote } from '@sigorta/shared';

type Drawer = 'gelir' | 'tahsilat' | null;

const emptyGelir = () => ({
  revenueType: 'file_fee',
  collectionSource: 'insurance_company',
  description: '',
  amount: '',
  vatRate: '0',
  entryDate: new Date().toISOString().split('T')[0],
  extraWorkItemId: '',
});

const emptyTahsilat = () => ({
  paymentType: 'incoming' as string,
  method: 'eft',
  payerType: 'insurance_company',
  payerId: '',
  amount: 0,
  currency: 'TRY',
  paymentDate: new Date().toISOString().substring(0, 10),
  status: 'completed',
  invoiceId: '',
  referenceNo: '',
  note: '',
  isAvans: false,
});

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ClaimFileGelirTahsilatPanel({ claimId }: { claimId: string }) {
  const { showToast } = useToast();
  const canDelete = canDeleteClaimFinance();
  const [revenues, setRevenues] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [extraWorks, setExtraWorks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [gelir, setGelir] = useState(emptyGelir);
  const [tahsilat, setTahsilat] = useState(emptyTahsilat);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rev, pay, inv, ven, ew] = await Promise.all([
        axios.get(`${API}/claim-files/${claimId}/revenues`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimId}/payments`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimId}/invoices`, { headers: authHeader() }),
        axios.get(`${API}/vendors?limit=200&status=active`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimId}/extra-works`, { headers: authHeader() }),
      ]);
      setRevenues(rev.data.data ?? rev.data ?? []);
      setPayments(pay.data.data ?? []);
      setInvoices(inv.data.data ?? []);
      setVendors(ven.data.data?.vendors ?? ven.data.data ?? []);
      setExtraWorks(ew.data.data ?? ew.data ?? []);
    } catch {
      setRevenues([]);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const list: Array<{
      id: string;
      kind: 'gelir' | 'tahsilat' | 'odeme';
      date: string;
      islem: string;
      aciklama: string;
      borc: number;
      alacak: number;
    }> = [];
    for (const r of revenues.filter((x) => x.status !== 'cancelled')) {
      list.push({
        id: `rev-${r.id}`,
        kind: 'gelir',
        date: r.entryDate ?? r.createdAt,
        islem: r.revenueType === 'extra_work' ? 'Ekstra İş' : 'Dosya Bedeli',
        aciklama: r.description || 'Gelir',
        borc: Number(r.totalAmount ?? r.amount ?? 0),
        alacak: 0,
      });
    }
    for (const p of payments) {
      const incoming = p.paymentType === 'incoming';
      list.push({
        id: `pay-${p.id}`,
        kind: incoming ? 'tahsilat' : 'odeme',
        date: p.paymentDate ?? p.createdAt,
        islem: incoming ? 'Tahsilat' : 'Tedarikçi Ödemesi',
        aciklama: p.note || p.referenceNo || (incoming ? 'Tahsilat' : 'Ödeme'),
        borc: incoming ? 0 : Number(p.amount ?? 0),
        alacak: incoming ? Number(p.amount ?? 0) : 0,
      });
    }
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let bakiye = 0;
    return list.map((row) => {
      bakiye += row.borc - row.alacak;
      return { ...row, bakiye };
    });
  }, [revenues, payments]);

  const totalGelir = rows.filter((r) => r.kind === 'gelir').reduce((s, r) => s + r.borc, 0);
  const totalTahsilat = rows.filter((r) => r.kind === 'tahsilat').reduce((s, r) => s + r.alacak, 0);
  const kalan = totalGelir - totalTahsilat;

  const saveGelir = async (andNew: boolean) => {
    if (!gelir.entryDate) { showToast('error', 'Tarih Zorunludur'); return; }
    if (!gelir.amount || parseFloat(gelir.amount) <= 0) { showToast('error', 'Tutar Sıfırdan Büyük Olmalıdır'); return; }
    if (!gelir.description.trim()) { showToast('error', 'Açıklama Zorunludur'); return; }
    if (gelir.revenueType === 'extra_work' && !gelir.extraWorkItemId) {
      showToast('error', 'Ekstra İş Seçilmesi Zorunludur');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/claim-files/${claimId}/revenues`,
        {
          revenueType: gelir.revenueType,
          collectionSource: gelir.collectionSource,
          description: gelir.description.trim(),
          amount: parseFloat(gelir.amount),
          vatRate: parseFloat(gelir.vatRate),
          entryDate: gelir.entryDate,
          extraWorkItemId: gelir.revenueType === 'extra_work' ? gelir.extraWorkItemId : undefined,
        },
        { headers: authHeader() },
      );
      showToast('success', 'Gelir Kaydedildi');
      setGelir(emptyGelir());
      await load();
      if (!andNew) setDrawer(null);
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Gelir Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const saveTahsilat = async (andNew: boolean) => {
    if (tahsilat.paymentType === 'outgoing' && tahsilat.payerType === 'vendor' && !tahsilat.payerId) {
      showToast('error', 'Tedarikçi ödemesi için tedarikçi seçiniz');
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...tahsilat, claimFileId: claimId };
      if (payload.payerType !== 'vendor') delete payload.payerId;
      if (payload.isAvans) payload.note = withAvansNote(payload.note);
      delete payload.isAvans;
      const res = await axios.post(`${API}/payments`, payload, { headers: authHeader() });
      const paymentId = res.data?.data?.id;
      if (paymentId && receiptFile && tahsilat.paymentType === 'outgoing' && tahsilat.payerType === 'vendor') {
        const fd = new FormData();
        fd.append('file', receiptFile);
        await axios.post(`${API}/payments/${paymentId}/receipt`, fd, {
          headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
        });
      }
      showToast('success', tahsilat.paymentType === 'incoming' ? 'Tahsilat Kaydedildi' : 'Ödeme Kaydedildi');
      setTahsilat(emptyTahsilat());
      setReceiptFile(null);
      await load();
      if (!andNew) setDrawer(null);
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Kayıt yapılamadı');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (row: (typeof rows)[number]) => {
    if (!canDelete) return;
    if (!window.confirm('Bu kayıt silinsin mi?')) return;
    try {
      if (row.kind === 'gelir') {
        await axios.delete(`${API}/claim-files/${claimId}/revenues/${row.id.replace('rev-', '')}`, { headers: authHeader() });
      } else {
        await axios.delete(`${API}/payments/${row.id.replace('pay-', '')}`, { headers: authHeader() });
      }
      showToast('success', 'Kayıt silindi');
      await load();
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Silinemedi');
    }
  };

  return (
    <div className="space-y-4">
      <OnlineCollectionLinksPanel claimFileId={claimId} />

      <FinansPanelCard
        title="Cari Hesap Ekstresi"
        subtitle="Gelir borç, tahsilat alacak — bakiye kalan alacak"
        action={{
          label: 'Yeni Gelir',
          onClick: () => { setGelir(emptyGelir()); setDrawer('gelir'); },
          variant: 'primary',
        }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => { setTahsilat(emptyTahsilat()); setDrawer('tahsilat'); }}
            className="inline-flex items-center rounded-lg border border-brand-600 bg-white px-3.5 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            Yeni Tahsilat
          </button>
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(`cari-ekstre-${claimId.slice(0, 8)}.csv`, [
                ['Tarih', 'İşlem', 'Açıklama', 'Borç', 'Alacak', 'Bakiye'],
                ...rows.map((r) => [
                  fmtDate(r.date),
                  r.islem,
                  r.aciklama,
                  String(r.borc),
                  String(r.alacak),
                  String(r.bakiye),
                ]),
              ])
            }
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
            Excel’e Aktar
          </button>
        </div>

        <FinansKpiStrip
          tone="light"
          items={[
            { label: 'Toplam Gelir', value: fmtCurrency(totalGelir) },
            { label: 'Tahsil Edilen', value: fmtCurrency(totalTahsilat), accent: 'text-emerald-400' },
            { label: 'Kalan Bakiye', value: fmtCurrency(kalan), accent: kalan > 0 ? 'text-amber-400' : 'text-white' },
          ]}
        />

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <FinansEmptyState
            title="Henüz hareket yok"
            description="Sağdan Yeni Gelir veya Yeni Tahsilat ile kayıt ekleyin."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Tarih</th>
                  <th className="px-3 py-2 text-left">İşlem</th>
                  <th className="px-3 py-2 text-left">Açıklama</th>
                  <th className="px-3 py-2 text-right">Borç</th>
                  <th className="px-3 py-2 text-right">Alacak</th>
                  <th className="px-3 py-2 text-right">Bakiye</th>
                  {canDelete && <th className="px-3 py-2 text-right"> </th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2 text-slate-700">{r.islem}</td>
                    <td className="px-3 py-2 text-slate-600">{r.aciklama}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.borc ? fmtCurrency(r.borc) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{r.alacak ? fmtCurrency(r.alacak) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-800">{fmtCurrency(r.bakiye)}</td>
                    {canDelete && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void removeRow(r)}
                          className="inline-flex rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FinansPanelCard>

      <SlidePanel
        open={drawer === 'gelir'}
        onClose={() => setDrawer(null)}
        title="Yeni Gelir"
        width={480}
        scrollContent={false}
      >
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <FinansFieldLabel required>Tarih</FinansFieldLabel>
            <TrDateInput value={gelir.entryDate} onChange={(entryDate) => setGelir({ ...gelir, entryDate })} className={finansInputClass} />
            <FinansFieldLabel>Gelir Tipi</FinansFieldLabel>
            <select value={gelir.revenueType} onChange={(e) => setGelir({ ...gelir, revenueType: e.target.value, extraWorkItemId: '' })} className={finansInputClass}>
              <option value="file_fee">Dosya Bedeli</option>
              <option value="extra_work">Ekstra İş</option>
            </select>
            <FinansFieldLabel>Tahsilat Kaynağı</FinansFieldLabel>
            <select value={gelir.collectionSource} onChange={(e) => setGelir({ ...gelir, collectionSource: e.target.value })} className={finansInputClass}>
              <option value="insurance_company">Sigorta Şirketi</option>
              <option value="insured">Sigortalı</option>
            </select>
            <FinansFieldLabel required>Tutar (TL)</FinansFieldLabel>
            <input type="number" min="0" step="0.01" value={gelir.amount} onChange={(e) => setGelir({ ...gelir, amount: e.target.value })} className={finansInputClass} />
            <FinansFieldLabel>KDV (%)</FinansFieldLabel>
            <input type="number" min="0" max="100" value={gelir.vatRate} onChange={(e) => setGelir({ ...gelir, vatRate: e.target.value })} className={finansInputClass} />
            {gelir.revenueType === 'extra_work' && (
              <>
                <FinansFieldLabel required>Ekstra İş</FinansFieldLabel>
                <select value={gelir.extraWorkItemId} onChange={(e) => setGelir({ ...gelir, extraWorkItemId: e.target.value })} className={finansInputClass}>
                  <option value="">Seçiniz…</option>
                  {extraWorks.map((ew: any) => (
                    <option key={ew.id} value={ew.id}>{ew.title}</option>
                  ))}
                </select>
              </>
            )}
            <FinansFieldLabel required>Açıklama</FinansFieldLabel>
            <input
              type="text"
              value={gelir.description}
              onChange={(e) => setGelir({ ...gelir, description: e.target.value })}
              onBlur={(e) => {
                const v = toTitleCaseTR(e.target.value.trim());
                if (v) setGelir({ ...gelir, description: v });
              }}
              className={finansInputClass}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
            <button type="button" onClick={() => setDrawer(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600">İptal</button>
            <button type="button" disabled={saving} onClick={() => void saveGelir(true)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">Kaydet ve Yeni</button>
            <button type="button" disabled={saving} onClick={() => void saveGelir(false)} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </div>
        </div>
      </SlidePanel>

      <SlidePanel
        open={drawer === 'tahsilat'}
        onClose={() => setDrawer(null)}
        title={tahsilat.paymentType === 'outgoing' ? 'Tedarikçi Ödemesi' : 'Yeni Tahsilat'}
        width={520}
        scrollContent={false}
      >
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <FinansFormSection title="Tahsilat Bilgileri">
              <div>
                <FinansFieldLabel>Yön</FinansFieldLabel>
                <select value={tahsilat.paymentType} onChange={(e) => setTahsilat({ ...tahsilat, paymentType: e.target.value })} className={finansInputClass}>
                  <option value="incoming">Gelen Tahsilat</option>
                  <option value="outgoing">Tedarikçi Ödemesi</option>
                </select>
              </div>
              <div>
                <FinansFieldLabel required>Tarih</FinansFieldLabel>
                <TrDateInput value={tahsilat.paymentDate} onChange={(paymentDate) => setTahsilat({ ...tahsilat, paymentDate })} className={finansInputClass} />
              </div>
              <div>
                <FinansFieldLabel required>Tutar (TRY)</FinansFieldLabel>
                <input type="number" min="0" step="0.01" value={tahsilat.amount} onChange={(e) => setTahsilat({ ...tahsilat, amount: parseFloat(e.target.value) || 0 })} className={finansInputClass} />
              </div>
              <div>
                <FinansFieldLabel>Yöntem</FinansFieldLabel>
                <select value={tahsilat.method} onChange={(e) => setTahsilat({ ...tahsilat, method: e.target.value })} className={finansInputClass}>
                  <option value="eft">EFT</option>
                  <option value="havale">Havale</option>
                  <option value="credit_card">Kredi Kartı</option>
                  <option value="cash">Nakit</option>
                  <option value="offset">Mahsuplaşma</option>
                </select>
              </div>
            </FinansFormSection>
            <div className="mt-4">
              <FinansFormSection title="Karşı Taraf">
                <div>
                  <FinansFieldLabel>Karşı Taraf</FinansFieldLabel>
                  <select value={tahsilat.payerType} onChange={(e) => setTahsilat({ ...tahsilat, payerType: e.target.value, payerId: '' })} className={finansInputClass}>
                    <option value="insurance_company">Sigorta Şirketi</option>
                    <option value="vendor">Tedarikçi</option>
                    <option value="customer">Müşteri</option>
                  </select>
                </div>
                {tahsilat.paymentType === 'outgoing' && tahsilat.payerType === 'vendor' && (
                  <div>
                    <FinansFieldLabel required>Tedarikçi</FinansFieldLabel>
                    <select value={tahsilat.payerId} onChange={(e) => setTahsilat({ ...tahsilat, payerId: e.target.value })} className={finansInputClass}>
                      <option value="">Tedarikçi Seçin…</option>
                      {vendors.map((v: any) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <FinansFieldLabel>Bağlı Fatura</FinansFieldLabel>
                  <select value={tahsilat.invoiceId} onChange={(e) => setTahsilat({ ...tahsilat, invoiceId: e.target.value })} className={finansInputClass}>
                    <option value="">Seçiniz…</option>
                    {invoices.filter((i: any) => !['cancelled', 'paid'].includes(i.status)).map((inv: any) => (
                      <option key={inv.id} value={inv.id}>{inv.invoiceNo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FinansFieldLabel>Referans No</FinansFieldLabel>
                  <input type="text" value={tahsilat.referenceNo} onChange={(e) => setTahsilat({ ...tahsilat, referenceNo: e.target.value })} className={finansInputClass} />
                </div>
                <div className="sm:col-span-2">
                  <FinansFieldLabel>Not</FinansFieldLabel>
                  <input type="text" value={tahsilat.note} onChange={(e) => setTahsilat({ ...tahsilat, note: e.target.value })} className={finansInputClass} />
                </div>
                {tahsilat.paymentType === 'outgoing' && tahsilat.payerType === 'vendor' && (
                  <>
                    <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-700">
                      <input type="checkbox" checked={tahsilat.isAvans} onChange={(e) => setTahsilat({ ...tahsilat, isAvans: e.target.checked })} />
                      Bu dosya için avans (onarım bitmeden)
                    </label>
                    <div className="sm:col-span-2">
                      <FinansFieldLabel>Dekont</FinansFieldLabel>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} className={finansFileInputClass} />
                    </div>
                  </>
                )}
              </FinansFormSection>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
            <button type="button" onClick={() => setDrawer(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600">İptal</button>
            <button type="button" disabled={saving} onClick={() => void saveTahsilat(true)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">Kaydet ve Yeni</button>
            <button type="button" disabled={saving} onClick={() => void saveTahsilat(false)} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
