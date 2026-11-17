'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import {
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  PlusCircle,
  Printer,
  ExternalLink,
} from 'lucide-react';
import {
  CARI_TUR_GRUPLARI,
  CARI_TUR_LABEL,
  buildCariBakiyeIletisimMesaji,
  cariBakiyeMetin,
  type CariTur,
} from '@sigorta/shared';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { formatTryAmount } from '@/utils/format-try-amount';
import { parseTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { downloadCsv } from '@/utils/download-csv';
import { openWhatsAppChat } from '@/utils/date-helpers';
import { formatPhoneGrouped } from '@/utils/validators';
import { useToast } from '@/contexts/ToastContext';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { FinansHedefBaglamSeridi } from '@/components/finance/FinansHedefBaglamSeridi';
import { hedefCiroDonYol, isHedefCiroDon } from '@/utils/finans-merkez-kart';
import {
  CariHesapFormFields,
  CARI_HESAP_EMPTY_FORM,
  newCariHesapForm,
  type CariHesapFormValues,
} from '@/components/finance/CariHesapFormFields';
import {
  FinansActionButton,
  FinansDrawer,
  FinansEmptyState,
  FinansFieldLabel,
  FinansKpiStrip,
  FinansPanelCard,
  finansInputClass,
} from '@/components/finance/FinansPanelUI';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  PanelTableColGroup,
  PanelTableScroll,
  PanelListToolbarPickers,
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import {
  FINANS_ACTIONS_COLUMN,
  FINANS_TABLE_PAGE_KEYS,
  readFinansTablePageSize,
  sliceFinansPage,
  type FinansTablePageSize,
} from '@/utils/finans-table-page';
import { PinnableRowActions } from '@/components/portal/PinnableRowActions';
import { PortalRowActionsPicker } from '@/components/portal/PortalRowActionsPicker';
import { FINANS_PARTY_CARI_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';
import { usePortalRowActionPrefs } from '@/components/portal/use-portal-row-action-prefs';

type CariRow = {
  id: string;
  name: string;
  kind: CariTur;
  kindLabel: string;
  notes: string | null;
  cardLast4: string | null;
  cardLabel: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  resolvedPhone: string | null;
  resolvedEmail: string | null;
  linkedCustomerId: string | null;
  linkedVendorId: string | null;
  toplamBorc: number;
  toplamAlacak: number;
  bakiyeLabel: string;
  bakiyeTutar: number;
  bakiyeYon: string;
  netBakiye: number;
  isActive: boolean;
};

/** Defter oranı: ad + tutarlar okunur; açıklama şişmez; işlemler sabit. */
const CARI_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'name', label: 'Cari Hesap', defaultWidth: 200, minWidth: 140 },
  { id: 'kind', label: 'Tür', defaultWidth: 100, minWidth: 84 },
  { id: 'aciklama', label: 'Açıklama', defaultWidth: 148, minWidth: 100 },
  { id: 'borc', label: 'Borç', defaultWidth: 124, minWidth: 104 },
  { id: 'alacak', label: 'Alacak', defaultWidth: 124, minWidth: 104 },
  { id: 'bakiye', label: 'Bakiye', defaultWidth: 152, minWidth: 128 },
  { id: 'status', label: 'Durum', defaultWidth: 80, minWidth: 72 },
  { ...FINANS_ACTIONS_COLUMN, defaultWidth: 188, minWidth: 172 },
];

function money(n: number) {
  return formatTryAmount(n, { fractionDigits: 2 });
}

function moneyCell(n: number) {
  if (!n) return '—';
  return money(n);
}

const EMPTY_FORM: CariHesapFormValues = { ...CARI_HESAP_EMPTY_FORM };

export default function FinansCarilerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const hedefBaglam = isHedefCiroDon(searchParams.get('don'));
  const baglamYear = Number(searchParams.get('year')) || new Date().getFullYear();
  const baglamMonth = Number(searchParams.get('month')) || new Date().getMonth() + 1;
  const rowActions = usePortalRowActionPrefs(
    'row-actions:finans-party-cari-v4',
    FINANS_PARTY_CARI_ROW_ACTIONS,
  );
  const [rows, setRows] = useState<CariRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<FinansTablePageSize>(() =>
    readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.cariler, 10),
  );
  const tableColumns = usePanelTableColumns('table-cols:finans-cariler-v3', CARI_TABLE_COLUMNS);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (kindFilter) params.set('kind', kindFilter);
    if (q.trim()) params.set('q', q.trim());
    params.set('activeOnly', 'false');
    axios
      .get(`${API}/finance/party-accounts?${params}`, { headers: authHeader() })
      .then((listRes) => {
        setRows(listRes.data.data ?? []);
      })
      .catch(() => setError('Veriler yüklenemedi'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindFilter]);

  const sortedRows = useMemo(
    () =>
      sortRowsByClientSort(rows, clientSort, (row, key) => {
        switch (key) {
          case 'name':
            return row.name;
          case 'kind':
            return row.kindLabel;
          case 'aciklama':
            return row.notes ?? '';
          case 'borc':
            return row.toplamBorc;
          case 'alacak':
            return row.toplamAlacak;
          case 'bakiye':
            return row.netBakiye;
          case 'status':
            return row.isActive ? 'Aktif' : 'Pasif';
          default:
            return '';
        }
      }),
    [rows, clientSort],
  );
  const paged = sliceFinansPage(sortedRows, page, pageSize);

  const totals = useMemo(() => {
    const toplamBorc = rows.reduce((s, r) => s + (Number(r.toplamBorc) || 0), 0);
    const toplamAlacak = rows.reduce((s, r) => s + (Number(r.toplamAlacak) || 0), 0);
    return { toplamBorc, toplamAlacak, net: toplamBorc - toplamAlacak };
  }, [rows]);

  const openNew = () => {
    setEditId(null);
    setForm(newCariHesapForm('kredi_karti'));
    setShowForm(true);
  };

  const openEdit = (row: CariRow) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      kind: row.kind,
      cardLast4: row.cardLast4 ?? '',
      cardLabel: row.cardLabel ?? '',
      contactPhone: row.contactPhone || row.resolvedPhone || '',
      contactEmail: row.contactEmail || row.resolvedEmail || '',
      notes: row.notes ?? '',
      openingAmount: '',
      openingDirection: newCariHesapForm(row.kind).openingDirection,
    });
    setShowForm(true);
  };

  const iletisimMesaji = (row: CariRow) =>
    buildCariBakiyeIletisimMesaji({
      cariAdi: row.name,
      bakiyeMetin: cariBakiyeMetin(row.netBakiye, money),
      aciklama: row.notes,
    });

  const sendMail = (row: CariRow) => {
    const email = row.resolvedEmail || row.contactEmail;
    if (!email) {
      showToast('warning', 'Bu caride e-posta yok. Düzenle’den ekleyin.');
      return;
    }
    const body = encodeURIComponent(iletisimMesaji(row));
    const subject = encodeURIComponent(`${row.name} — Cari Bakiye`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const sendWhatsApp = (row: CariRow) => {
    const phone = row.resolvedPhone || row.contactPhone;
    if (!phone) {
      showToast('warning', 'Bu caride telefon yok. Düzenle’den ekleyin.');
      return;
    }
    const ok = openWhatsAppChat(phone, iletisimMesaji(row));
    if (!ok) showToast('error', 'WhatsApp açılamadı');
  };

  const callPhone = (row: CariRow) => {
    const phone = row.resolvedPhone || row.contactPhone;
    if (!phone) {
      showToast('warning', 'Bu caride telefon yok. Düzenle’den ekleyin.');
      return;
    }
    window.location.href = `tel:${phone.replace(/\s/g, '')}`;
  };

  const copyBakiye = async (row: CariRow) => {
    const metin = iletisimMesaji(row);
    try {
      await navigator.clipboard.writeText(metin);
      showToast('success', 'Bakiye metni kopyalandı');
    } catch {
      showToast('error', 'Kopyalanamadı');
    }
  };

  const exportRowEkstre = async (row: CariRow) => {
    try {
      const res = await axios.get(`${API}/finance/party-accounts/${row.id}/statement`, {
        headers: authHeader(),
      });
      const lines = (res.data?.data?.lines ?? []) as Array<{
        entryDate: string;
        description: string;
        debitAmount: number;
        creditAmount: number;
        runningBalance: number;
        sourceKind: string;
      }>;
      if (lines.length === 0) {
        showToast('warning', 'Aktarılacak hareket yok');
        return;
      }
      downloadCsv(
        `cari-ekstre-${row.name.replace(/\s+/g, '-').slice(0, 40)}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`,
        [
          ['Tarih', 'Açıklama', 'Borç', 'Alacak', 'Bakiye', 'Kaynak'],
          ...lines.map((line) => [
            String(line.entryDate).slice(0, 10),
            line.description,
            String(line.debitAmount || 0),
            String(line.creditAmount || 0),
            cariBakiyeMetin(line.runningBalance, (n) => String(n)),
            line.sourceKind,
          ]),
        ],
      );
      showToast('success', 'Excel Dosyası İndiriliyor');
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Ekstre aktarılamadı'));
    }
  };

  const handleSave = async () => {
    const name = toTitleCaseTR(form.name.trim());
    if (name.length < 2) {
      showToast('warning', 'Cari Hesap Adı Zorunludur');
      return;
    }
    const notes = form.notes ? toTitleCaseTR(form.notes.trim()) : '';
    if (!notes) {
      showToast('warning', 'Açıklama Zorunludur');
      return;
    }
    const openingAmount = parseTrAmountInput(form.openingAmount) ?? 0;
    setSaving(true);
    try {
      const contactPhone = form.contactPhone.trim()
        ? formatPhoneGrouped(form.contactPhone.trim()) || form.contactPhone.trim()
        : '';
      const contactEmail = form.contactEmail.trim().toLowerCase();
      if (editId) {
        await axios.patch(
          `${API}/finance/party-accounts/${editId}`,
          {
            name,
            kind: form.kind,
            cardLast4: form.cardLast4 || null,
            cardLabel: form.cardLabel ? toTitleCaseTR(form.cardLabel.trim()) : null,
            contactPhone: contactPhone || null,
            contactEmail: contactEmail || null,
            notes,
          },
          { headers: authHeader() },
        );
        showToast('success', 'Cari Hesap Güncellendi');
      } else {
        await axios.post(
          `${API}/finance/party-accounts`,
          {
            name,
            kind: form.kind,
            cardLast4: form.cardLast4 || undefined,
            cardLabel: form.cardLabel ? toTitleCaseTR(form.cardLabel.trim()) : undefined,
            contactPhone: contactPhone || undefined,
            contactEmail: contactEmail || undefined,
            notes,
            openingAmount: openingAmount > 0 ? openingAmount : undefined,
            openingDirection: openingAmount > 0 ? form.openingDirection : undefined,
          },
          { headers: authHeader() },
        );
        showToast('success', 'Cari Hesap Kaydedildi');
      }
      setShowForm(false);
      setEditId(null);
      load();
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Kayıt yapılamadı'));
    } finally {
      setSaving(false);
    }
  };

  const setActiveState = async (row: CariRow, isActive: boolean) => {
    try {
      await axios.patch(
        `${API}/finance/party-accounts/${row.id}`,
        { isActive },
        { headers: authHeader() },
      );
      showToast('success', isActive ? 'Cari Aktife Alındı' : 'Cari Pasife Alındı');
      load();
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Durum güncellenemedi'));
    }
  };

  const exportExcel = () => {
    if (sortedRows.length === 0) {
      showToast('warning', 'Aktarılacak kayıt yok');
      return;
    }
    downloadCsv(`cariler-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Cari Hesap', 'Tür', 'Açıklama', 'Borç', 'Alacak', 'Bakiye', 'Durum'],
      ...sortedRows.map((r) => [
        r.name,
        r.kindLabel,
        r.notes ?? '',
        String(r.toplamBorc ?? 0),
        String(r.toplamAlacak ?? 0),
        cariBakiyeMetin(r.netBakiye, (n) => String(n)),
        r.isActive ? 'Aktif' : 'Pasif',
      ]),
    ]);
    showToast('success', 'Excel Dosyası İndiriliyor');
  };

  return (
    <div className="space-y-5 min-h-screen bg-white dark:bg-slate-900 p-6">
      <FinansSubpageBreadcrumb
        current="Cariler"
        backHref={hedefBaglam ? hedefCiroDonYol(baglamYear, baglamMonth) : undefined}
        backLabel={hedefBaglam ? 'Hedef Ciroya Dön' : undefined}
      />
      {hedefBaglam ? (
        <FinansHedefBaglamSeridi
          year={baglamYear}
          month={baglamMonth}
          aciklama="Cari borç veya alacak buradan girilir. Bitince Hedef Ciroya dönün; öneri yenilenir."
        />
      ) : null}
      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.finansCariOmurga.id}
        title={OPS_NOTICE.finansCariOmurga.title}
        body={OPS_NOTICE.finansCariOmurga.body}
        testId="finans-cari-ilk-kullanim-seridi"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Cariler</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Defter görünümü · Borç / Alacak / Bakiye. Müşteri ve tedarikçi kartı sol menüden açılır.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/panel/musteriler"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            data-testid="cari-musteri-kartina-git"
          >
            Müşteri Kartı
          </Link>
          <Link
            href="/panel/tedarikciler"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            data-testid="cari-tedarikci-kartina-git"
          >
            Tedarikçi Kartı
          </Link>
          <button
            type="button"
            onClick={exportExcel}
            disabled={rows.length === 0}
            data-testid="cari-excel-aktar"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
            Excel&apos;e Aktar
          </button>
          <FinansActionButton
            label="Şirket Carisi"
            onClick={openNew}
            variant="primary"
            showPlus
            testId="cari-sirket-hesabi-ac"
          />
        </div>
      </div>

      <FinansKpiStrip
        tone="light"
        items={[
          { label: 'Toplam Borç', value: money(totals.toplamBorc) },
          { label: 'Toplam Alacak', value: money(totals.toplamAlacak) },
          {
            label: 'Net Bakiye',
            value: cariBakiyeMetin(totals.net, money),
            accent: totals.net < 0 ? 'text-amber-700' : 'text-slate-900',
          },
        ]}
      />

      <FinansDrawer
        open={showForm}
        title={editId ? 'Cari Hesabı Düzenle' : 'Şirket Carisi'}
        subtitle="Kredi kartı, banka, vergi, SGK veya kredi hesabı. Müşteri / tedarikçi sol menüden açılır."
        testId="cari-hesap-cekmece"
        onClose={() => {
          setShowForm(false);
          setEditId(null);
        }}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FinansActionButton
              label="İptal"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              variant="neutral"
              showPlus={false}
              disabled={saving}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void handleSave();
              }}
              className="inline-flex items-center rounded-lg border border-brand-600 bg-brand-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
              data-testid="cari-hesap-cekmece-kaydet"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        }
      >
        <CariHesapFormFields form={form} setForm={setForm} showOpening={!editId} />
      </FinansDrawer>

      <div className="flex max-w-2xl flex-wrap items-end gap-3">
        <div className="w-[148px] shrink-0">
          <FinansFieldLabel>Tür</FinansFieldLabel>
          <select
            value={kindFilter}
            onChange={(e) => {
              setPage(1);
              setKindFilter(e.target.value);
            }}
            className={finansInputClass}
          >
            <option value="">Tümü</option>
            {CARI_TUR_GRUPLARI.map((grup) => (
              <optgroup key={grup.label} label={grup.label}>
                {grup.kinds.map((value) => (
                  <option key={value} value={value}>
                    {CARI_TUR_LABEL[value]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <FinansFieldLabel>Ara</FinansFieldLabel>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                load();
              }
            }}
            className={finansInputClass}
            placeholder="Cari hesap veya açıklama"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            load();
          }}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Ara
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400">Yükleniyor...</div>
      ) : error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <FinansPanelCard title="Cari Hesaplar">
          <FinansEmptyState
            title="Kayıtlı cari hesap yok."
            description="Müşteri, tedarikçi veya kredi kartı cari hesabı ekleyin."
          />
        </FinansPanelCard>
      ) : (
        <TableColumnsProvider value={tableColumns}>
          <FinansPanelCard title="Cari Hesaplar" subtitle={`${rows.length} kayıt`} noPadding>
            <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 px-4 py-2">
              <PanelListToolbarPickers>
                <PortalRowActionsPicker
                  catalog={FINANS_PARTY_CARI_ROW_ACTIONS}
                  pinnedIds={rowActions.pinnedIds}
                  onToggle={rowActions.toggle}
                  onReset={rowActions.reset}
                />
                <PanelTableColumnPicker tableColumns={tableColumns} />
              </PanelListToolbarPickers>
            </div>
            <PanelTableScroll>
              <table className="text-sm" style={panelTableLayoutStyle(tableColumns)}>
                <PanelTableColGroup />
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {tableColumns.prefs.orderedVisibleColumns.map((col) =>
                      col.id === 'actions' ? (
                        <PanelTableTh
                          key={col.id}
                          colId={col.id}
                          className="px-2 py-3 text-center"
                          resizable={false}
                        >
                          {col.label}
                        </PanelTableTh>
                      ) : (
                        <SortablePanelTableTh
                          key={col.id}
                          colId={col.id}
                          sortKey={col.id}
                          activeSortKey={clientSort?.key ?? null}
                          sortDir={clientSort?.dir ?? 'asc'}
                          onSort={(k) => setClientSort((p) => cycleClientSort(p, k))}
                          className={`px-3 py-3 ${
                            col.id === 'borc' || col.id === 'alacak' || col.id === 'bakiye'
                              ? 'text-right'
                              : col.id === 'status'
                                ? 'text-center'
                                : 'text-left'
                          }`}
                        >
                          {col.label}
                        </SortablePanelTableTh>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.slice.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50 ${row.isActive ? '' : 'opacity-60'}`}
                    >
                      {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                        switch (col.id) {
                          case 'name':
                            return (
                              <PanelTableTd
                                key={col.id}
                                colId="name"
                                className="px-3 py-3 font-medium text-slate-800"
                              >
                                <Link
                                  href={`/panel/finans/cariler/${row.id}`}
                                  className="block truncate text-brand-700 hover:underline"
                                  title={row.name}
                                >
                                  {row.name}
                                </Link>
                              </PanelTableTd>
                            );
                          case 'kind':
                            return (
                              <PanelTableTd
                                key={col.id}
                                colId="kind"
                                className="px-3 py-3 text-slate-600"
                              >
                                <span className="block truncate" title={row.kindLabel}>
                                  {row.kindLabel}
                                </span>
                              </PanelTableTd>
                            );
                          case 'aciklama':
                            return (
                              <PanelTableTd
                                key={col.id}
                                colId="aciklama"
                                className="px-3 py-3 text-slate-600"
                              >
                                <span className="block truncate" title={row.notes || undefined}>
                                  {row.notes || '—'}
                                </span>
                              </PanelTableTd>
                            );
                          case 'borc':
                            return (
                              <PanelTableTd
                                key={col.id}
                                colId="borc"
                                className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700"
                              >
                                {moneyCell(row.toplamBorc)}
                              </PanelTableTd>
                            );
                          case 'alacak':
                            return (
                              <PanelTableTd
                                key={col.id}
                                colId="alacak"
                                className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700"
                              >
                                {moneyCell(row.toplamAlacak)}
                              </PanelTableTd>
                            );
                          case 'bakiye':
                            return (
                              <PanelTableTd
                                key={col.id}
                                colId="bakiye"
                                className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums text-slate-800"
                              >
                                {cariBakiyeMetin(row.netBakiye, money)}
                              </PanelTableTd>
                            );
                          case 'status':
                            return (
                              <PanelTableTd
                                key={col.id}
                                colId="status"
                                className="px-2 py-3 text-center"
                              >
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                    row.isActive
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {row.isActive ? 'Aktif' : 'Pasif'}
                                </span>
                              </PanelTableTd>
                            );
                          case 'actions':
                            return (
                              <PanelTableTd
                                key={col.id}
                                colId="actions"
                                className="whitespace-nowrap px-2 py-3 text-center"
                              >
                                <PinnableRowActions
                                  rowId={row.id}
                                  menuEvent="finans-party-cari-menu-open"
                                  testId="party-cari-satir-islemler"
                                  menuTestId="party-cari-menu"
                                  moreTestId="party-cari-more"
                                  pinnedIds={rowActions.pinnedIds}
                                  items={[
                                    {
                                      id: 'ekstre',
                                      label: 'Ekstre',
                                      icon: <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />,
                                      onClick: () =>
                                        router.push(`/panel/finans/cariler/${row.id}`),
                                    },
                                    {
                                      id: 'edit',
                                      label: 'Düzenle',
                                      icon: <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />,
                                      onClick: () => openEdit(row),
                                    },
                                    {
                                      id: 'mail',
                                      label: 'Mail Gönder',
                                      icon: <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />,
                                      onClick: () => sendMail(row),
                                    },
                                    {
                                      id: 'whatsapp',
                                      label: 'WhatsApp',
                                      icon: (
                                        <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                                      ),
                                      onClick: () => sendWhatsApp(row),
                                    },
                                    {
                                      id: 'ara',
                                      label: 'Ara',
                                      icon: <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />,
                                      onClick: () => callPhone(row),
                                    },
                                    {
                                      id: 'kopyala',
                                      label: 'Bakiye Kopyala',
                                      icon: <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />,
                                      onClick: () => {
                                        void copyBakiye(row);
                                      },
                                    },
                                    {
                                      id: 'hareket',
                                      label: 'Hareket Ekle',
                                      icon: (
                                        <PlusCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                                      ),
                                      onClick: () =>
                                        router.push(
                                          `/panel/finans/cariler/${row.id}?hareket=1`,
                                        ),
                                    },
                                    {
                                      id: 'kart',
                                      label: 'Kartı Aç',
                                      icon: (
                                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                                      ),
                                      hidden: !row.linkedCustomerId && !row.linkedVendorId,
                                      onClick: () => {
                                        if (row.linkedCustomerId) {
                                          router.push(`/panel/musteriler/${row.linkedCustomerId}`);
                                          return;
                                        }
                                        if (row.linkedVendorId) {
                                          router.push(`/panel/tedarikciler/${row.linkedVendorId}`);
                                        }
                                      },
                                    },
                                    {
                                      id: 'yazdir',
                                      label: 'Yazdır',
                                      icon: <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />,
                                      onClick: () =>
                                        window.open(
                                          `/panel/finans/cariler/${row.id}?yazdir=1`,
                                          '_blank',
                                        ),
                                    },
                                    {
                                      id: 'excel',
                                      label: 'Excel Ekstre',
                                      icon: (
                                        <FileSpreadsheet
                                          className="h-3.5 w-3.5"
                                          strokeWidth={1.75}
                                        />
                                      ),
                                      onClick: () => {
                                        void exportRowEkstre(row);
                                      },
                                    },
                                    {
                                      id: 'pasif',
                                      label: 'Pasife Al',
                                      icon: <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />,
                                      hidden: !row.isActive,
                                      danger: true,
                                      onClick: () => {
                                        void setActiveState(row, false);
                                      },
                                    },
                                    {
                                      id: 'aktif',
                                      label: 'Aktife Al',
                                      icon: (
                                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                                      ),
                                      hidden: row.isActive,
                                      onClick: () => {
                                        void setActiveState(row, true);
                                      },
                                    },
                                  ]}
                                />
                              </PanelTableTd>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </PanelTableScroll>
            <FinansTablePager
              page={paged.safePage}
              pageSize={pageSize}
              total={sortedRows.length}
              storageKey={FINANS_TABLE_PAGE_KEYS.cariler}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </FinansPanelCard>
        </TableColumnsProvider>
      )}
    </div>
  );
}
