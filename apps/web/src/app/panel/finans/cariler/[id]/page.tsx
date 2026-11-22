'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { FileSpreadsheet, Mail, MessageCircle, Phone } from 'lucide-react';
import { buildCariBakiyeIletisimMesaji, cariBakiyeMetin, resolveFinansIslemTarihiDonemDurum } from '@sigorta/shared';
import { FinansTarihDonemUyariIkon } from '@/components/finance/FinansTarihDonemUyariIkon';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { formatTryAmount } from '@/utils/format-try-amount';
import { parseTrAmountInput } from '@/utils/tr-amount-input';
import { isCompleteTrDateValue, normalizeTrDateValue } from '@/utils/tr-date-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { downloadCsv } from '@/utils/download-csv';
import { openWhatsAppChat } from '@/utils/date-helpers';
import { useToast } from '@/contexts/ToastContext';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import {
  FinansActionButton,
  FinansEmptyState,
  FinansFieldLabel,
  FinansFormPanel,
  FinansKpiStrip,
  FinansPanelCard,
  finansInputClass,
} from '@/components/finance/FinansPanelUI';
import { CariTahsilatAlModal } from '@/components/finance/CariTahsilatAlModal';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { TrDateInput } from '@/components/ui/TrDateInput';

type Account = {
  id: string;
  name: string;
  kind?: string;
  kindLabel: string;
  notes: string | null;
  toplamBorc: number;
  toplamAlacak: number;
  bakiyeLabel: string;
  bakiyeTutar: number;
  bakiyeYon: string;
  netBakiye: number;
  cardLast4: string | null;
  cardLabel: string | null;
  linkedCustomerId?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  resolvedPhone?: string | null;
  resolvedEmail?: string | null;
};

type Line = {
  id: string;
  entryDate: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  sourceKind: string;
  runningBalance: number;
  createdByName: string;
};

function money(n: number) {
  return formatTryAmount(n, { fractionDigits: 2 });
}

function moneyCell(n: number) {
  if (!n) return '—';
  return money(n);
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('tr-TR');
}

function sourceLabel(kind: string) {
  switch (kind) {
    case 'acilis':
      return 'Açılış';
    case 'manuel':
      return 'Manuel';
    case 'masraf':
      return 'Masraf';
    case 'odeme':
      return 'Ödeme';
    case 'tahsilat':
      return 'Tahsilat';
    case 'gelir':
      return 'Gelir';
    case 'fatura':
      return 'Fatura';
    default:
      return kind;
  }
}

export default function FinansCariEkstrePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params?.id ?? '');
  const { showToast } = useToast();
  const [account, setAccount] = useState<Account | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showTahsilat, setShowTahsilat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    description: '',
    yon: 'borc' as 'borc' | 'alacak',
    amount: '',
  });

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError('');
    axios
      .get(`${API}/finance/party-accounts/${id}/statement`, { headers: authHeader() })
      .then((r) => {
        setAccount(r.data.data?.account ?? null);
        setLines(r.data.data?.lines ?? []);
      })
      .catch(() => setError('Ekstre yüklenemedi'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (searchParams.get('hareket') === '1') setShowForm(true);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('yazdir') !== '1') return;
    if (loading) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [searchParams, loading, lines.length]);

  const handleSave = async () => {
    const amount = parseTrAmountInput(form.amount) ?? 0;
    const description = toTitleCaseTR(form.description.trim());
    if (amount <= 0) {
      showToast('warning', 'Tutar Girin');
      return;
    }
    if (description.length < 2) {
      showToast('warning', 'Açıklama Zorunludur');
      return;
    }
    const entryDate = normalizeTrDateValue(form.entryDate);
    if (!isCompleteTrDateValue(entryDate)) {
      showToast('warning', 'Tarih Zorunludur');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/finance/party-accounts/${id}/entries`,
        {
          entryDate,
          description,
          debitAmount: form.yon === 'alacak' ? amount : 0,
          creditAmount: form.yon === 'borc' ? amount : 0,
        },
        { headers: authHeader() },
      );
      setAccount(res.data.data?.account ?? account);
      setLines(res.data.data?.lines ?? []);
      setShowForm(false);
      setForm({
        entryDate: new Date().toISOString().slice(0, 10),
        description: '',
        yon: 'borc',
        amount: '',
      });
      showToast('success', 'Hareket Kaydedildi');
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Hareket kaydedilemedi'));
    } finally {
      setSaving(false);
    }
  };

  const iletisimMesaji = () => {
    if (!account) return '';
    return buildCariBakiyeIletisimMesaji({
      cariAdi: account.name,
      bakiyeMetin: cariBakiyeMetin(account.netBakiye ?? 0, money),
      aciklama: account.notes,
    });
  };

  const sendMail = () => {
    if (!account) return;
    const email = account.resolvedEmail || account.contactEmail;
    if (!email) {
      showToast('warning', 'Bu caride e-posta yok. Listeden Düzenle ile ekleyin.');
      return;
    }
    const body = encodeURIComponent(iletisimMesaji());
    const subject = encodeURIComponent(`${account.name} — Cari Bakiye`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const sendWhatsApp = () => {
    if (!account) return;
    const phone = account.resolvedPhone || account.contactPhone;
    if (!phone) {
      showToast('warning', 'Bu caride telefon yok. Listeden Düzenle ile ekleyin.');
      return;
    }
    const ok = openWhatsAppChat(phone, iletisimMesaji());
    if (!ok) showToast('error', 'WhatsApp açılamadı');
  };

  const callPhone = () => {
    if (!account) return;
    const phone = account.resolvedPhone || account.contactPhone;
    if (!phone) {
      showToast('warning', 'Bu caride telefon yok. Listeden Düzenle ile ekleyin.');
      return;
    }
    window.location.href = `tel:${phone.replace(/\s/g, '')}`;
  };

  const exportExcel = () => {
    if (!account || lines.length === 0) {
      showToast('warning', 'Aktarılacak hareket yok');
      return;
    }
    downloadCsv(
      `cari-ekstre-${account.name.replace(/\s+/g, '-').slice(0, 40)}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`,
      [
        ['Tarih', 'Açıklama', 'Borç', 'Alacak', 'Bakiye', 'Kaynak'],
        ...lines.map((line) => [
          dateLabel(line.entryDate),
          line.description,
          String(line.debitAmount || 0),
          String(line.creditAmount || 0),
          cariBakiyeMetin(line.runningBalance, (n) => String(n)),
          sourceLabel(line.sourceKind),
        ]),
      ],
    );
    showToast('success', 'Excel Dosyası İndiriliyor');
  };

  return (
    <div className="space-y-5 min-h-screen bg-white dark:bg-slate-900 p-6">
      <FinansSubpageBreadcrumb
        current={account?.name ?? 'Cari Ekstre'}
        backHref="/panel/finans/cariler"
        backLabel="Carilere Dön"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{account?.name ?? 'Cari Ekstre'}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {account
              ? `${account.kindLabel}${
                  account.notes ? ` · ${account.notes}` : ''
                }${
                  account.cardLast4
                    ? ` · **** ${account.cardLast4}${
                        account.cardLabel ? ` · ${account.cardLabel}` : ''
                      }`
                    : ''
                }`
              : 'Hareketler · Borç / Alacak / Bakiye'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/panel/finans/cariler"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Listeye Dön
          </Link>
          <button
            type="button"
            onClick={sendMail}
            disabled={!account}
            data-testid="cari-ekstre-mail"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
            Mail Gönder
          </button>
          <button
            type="button"
            onClick={sendWhatsApp}
            disabled={!account}
            data-testid="cari-ekstre-whatsapp"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
          >
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={callPhone}
            disabled={!account}
            data-testid="cari-ekstre-ara"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
            Ara
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={lines.length === 0}
            data-testid="cari-ekstre-excel"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
            Excel&apos;e Aktar
          </button>
          {(account?.kind === 'musteri' || account?.kind === 'musteri_tedarikci') &&
          account.linkedCustomerId ? (
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setShowTahsilat(true);
              }}
              data-testid="cari-tahsilat-al-ac"
              className="inline-flex items-center rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-700"
            >
              Tahsilat Ekle
            </button>
          ) : null}
          <FinansActionButton
            label={showForm ? 'Formu Kapat' : 'Hareket Ekle'}
            onClick={() => {
              setShowTahsilat(false);
              setShowForm((v) => !v);
            }}
            variant={showForm ? 'neutral' : 'primary'}
            active={showForm}
            showPlus={!showForm}
          />
        </div>
      </div>

      <CariTahsilatAlModal
        open={showTahsilat}
        onClose={() => setShowTahsilat(false)}
        onSaved={() => load()}
        fixedCustomer={
          account?.linkedCustomerId
            ? { customerId: account.linkedCustomerId, label: account.name }
            : null
        }
      />

      {account && (
        <FinansKpiStrip
          tone="light"
          items={[
            { label: 'Toplam Borç', value: money(account.toplamBorc ?? 0) },
            { label: 'Toplam Alacak', value: money(account.toplamAlacak ?? 0) },
            {
              label: 'Bakiye',
              value: cariBakiyeMetin(account.netBakiye ?? 0, money),
            },
          ]}
        />
      )}

      {showForm && (
        <FinansFormPanel
          title="Hareket Ekle"
          onCancel={() => setShowForm(false)}
          onSubmit={() => {
            void handleSave();
          }}
          saving={saving}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">
                  Tarih <span className="ml-1 text-xs font-normal text-slate-400">(Zorunlu)</span>
                </label>
                {(() => {
                  const dateIso = normalizeTrDateValue(form.entryDate);
                  if (!isCompleteTrDateValue(dateIso)) return null;
                  const durum = resolveFinansIslemTarihiDonemDurum(dateIso);
                  if (durum.kind === 'ok') return null;
                  return (
                    <FinansTarihDonemUyariIkon
                      message={durum.message}
                      closed={durum.kind === 'closed'}
                      testId="cari-hareket-tarih-donem-uyari"
                    />
                  );
                })()}
              </div>
              <TrDateInput
                value={form.entryDate}
                onChange={(entryDate) => setForm({ ...form, entryDate })}
                className={finansInputClass}
              />
            </div>
            <div>
              <FinansFieldLabel required>Borç / Alacak</FinansFieldLabel>
              <select
                value={form.yon}
                onChange={(e) =>
                  setForm({ ...form, yon: e.target.value as 'borc' | 'alacak' })
                }
                className={finansInputClass}
              >
                <option value="alacak">Borç</option>
                <option value="borc">Alacak</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Borç: cari bize borçlu · Alacak: biz cariye borçluyuz
              </p>
            </div>
            <div>
              <FinansFieldLabel required>Tutar</FinansFieldLabel>
              <TrAmountInput
                value={form.amount}
                onChange={(amount) => setForm({ ...form, amount })}
                className={finansInputClass}
                placeholder="0"
              />
            </div>
            <div>
              <FinansFieldLabel required>Açıklama</FinansFieldLabel>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                onBlur={() =>
                  setForm((f) => ({
                    ...f,
                    description: f.description ? toTitleCaseTR(f.description.trim()) : '',
                  }))
                }
                className={finansInputClass}
                placeholder="Örn. kart ekstresi ödemesi"
                data-testid="cari-hareket-aciklama"
              />
            </div>
          </div>
        </FinansFormPanel>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400">Yükleniyor...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      ) : lines.length === 0 ? (
        <FinansPanelCard title="Ekstre">
          <FinansEmptyState
            title="Hareket yok."
            description="Açılış bakiyesi veya hareket ekleyin."
          />
        </FinansPanelCard>
      ) : (
        <FinansPanelCard title="Ekstre" subtitle={`${lines.length} satır`} noPadding>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tarih</th>
                  <th className="px-4 py-3 text-left font-medium">Açıklama</th>
                  <th className="px-4 py-3 text-right font-medium">Borç</th>
                  <th className="px-4 py-3 text-right font-medium">Alacak</th>
                  <th className="px-4 py-3 text-right font-medium">Bakiye</th>
                  <th className="px-4 py-3 text-left font-medium">Kaynak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{dateLabel(line.entryDate)}</td>
                    <td className="px-4 py-3 text-slate-800">{line.description}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {moneyCell(line.debitAmount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {moneyCell(line.creditAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-800">
                      {cariBakiyeMetin(line.runningBalance, money)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{sourceLabel(line.sourceKind)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FinansPanelCard>
      )}
    </div>
  );
}
