'use client';

/**
 * Acil planlayıcı adım içerikleri — canlı + lokal önizleme ortak.
 */

import { useState, type ReactNode } from 'react';
import { Phone, TrendingDown, TrendingUp, UserRound, Wallet, Mail } from 'lucide-react';
import { calcAlisSatisKar, formatTryAmount, parseTrAmount } from '@/utils/format-try-amount';
import { isAcilDigitalApprovalRequired } from '@sigorta/shared';
import { WhatsAppIcon } from '@/components/ui/PhoneContactActions';
import type { VendorRecommendation } from '@/utils/emergencyApi';
import type { AcilStageKey } from '@/app/panel/acil-yardim/[id]/acil-workflow';
import {
  STANDARD_VAT_RATE,
  calcVatBreakdown,
  type VatMode,
} from '@/app/panel/acil-yardim/[id]/acil-price-helpers';
import {
  ACIL_ONAY_METIN_ON_EK,
  acilOnayMetinGovde,
  withAcilOnayMetinOnEk,
} from './planner-gates';
import {
  anaMusteriAllowsEmail,
  anaMusteriAllowsWhatsApp,
  type AnaMusteriHaberlesme,
} from '@/utils/acil-ana-musteri-haberlesme';

export type OperatorStepKey =
  | 'ihbar'
  | 'tedarikci_maliyet'
  | 'onay'
  | 'kapanis'
  | 'finans';

export const OPERATOR_STEPS: Array<{
  key: OperatorStepKey;
  label: string;
  hint: string;
  stageKeys: AcilStageKey[];
}> = [
  { key: 'ihbar', label: 'İhbar', hint: 'Mail kaydı, dosya içeriği', stageKeys: ['ihbar'] },
  {
    key: 'tedarikci_maliyet',
    label: 'Tedarikçi Ve Maliyet',
    hint: 'Atama ve alış/satış',
    stageKeys: ['tedarikci_atandi', 'maliyet_alindi'],
  },
  {
    key: 'onay',
    label: 'Onay Talep Akışı',
    hint: 'Bedel sunumu, servis formu, sigortalı haber',
    stageKeys: ['asistans_onayi_bekleniyor', 'ise_baslama'],
  },
  {
    key: 'kapanis',
    label: 'Kapanış',
    hint: 'Resim, detay, mail+PDF; anket kapandıktan sonra',
    stageKeys: ['hizmet_tamamlandi', 'dosya_kapatildi'],
  },
  { key: 'finans', label: 'Ödeme Ve Finans', hint: 'Ödeme kaydı, finansa aktarım', stageKeys: ['finansa_aktarildi'] },
];

export type ApprovalChannel = 'email' | 'whatsapp_group';
export type ApprovalState = 'bekliyor' | 'onaylandi' | 'reddedildi';
export type WaLogRow = { at: string; to: string; text: string };

export type PlannerStepBodyProps = {
  step: OperatorStepKey;
  file: {
    fileNo: string;
    insured: string;
    phone: string;
    customer: string;
    customerPhone: string;
    customerEmail: string;
    subject: string;
    ihbarDate: string;
    workStartedAt?: string;
    serviceDeliveredAt?: string;
    closedAt?: string;
    appointmentDate: string;
    appointmentTime: string;
  };
  address: string;
  vendorWhatsAppText?: string;
  vendors: VendorRecommendation[];
  assigned: string | null;
  assignedVendor: VendorRecommendation | null;
  alis: string;
  satis: string;
  workStartOk: boolean;
  serviceDone?: boolean;
  fileClosed: boolean;
  hakedisAt: string | null;
  financeSent: boolean;
  financeAt: string | null;
  approvalChannel: ApprovalChannel;
  approvalState: ApprovalState;
  approvalRequestedAt: string;
  approvalDecidedAt: string | null;
  approvalText: string;
  waLog: WaLogRow[];
  photos: Array<{ url: string; label: string; at: string }>;
  digitalDocsOk?: boolean;
  vendorPaid?: boolean | null;
  satisNetLabel?: string;
  alisVatMode?: VatMode;
  satisVatMode?: VatMode;
  inboxPhotoCount?: number;
  skipVendorPicker?: boolean;
  customerNotifyChannel?: AnaMusteriHaberlesme;
  onCustomerNotifyChannel?: (v: AnaMusteriHaberlesme) => void;
  onCustomerEmail?: () => void;
  onClosureEmail?: () => void;
  onAssign: (id: string) => void;
  onAlis: (v: string) => void;
  onSatis: (v: string) => void;
  onWorkStart: (v: boolean) => void;
  onServiceComplete?: (v: boolean) => void;
  onCloseFile: () => void;
  onFinance: () => void;
  /** Admin veya Acil vekaletli finans — dosya sorumlusu görmez */
  canOpenFinancePage?: boolean;
  onVendorPaid?: (v: boolean) => void;
  onInsuredNotify?: () => void;
  onClosureSurvey?: () => void;
  onApprovalChannel: (v: ApprovalChannel) => void;
  onApprovalState: (v: ApprovalState) => void;
  onApprovalText: (v: string) => void;
  onWhatsApp: (to: 'Tedarikçi' | 'Müşteri' | 'Sigortalı', phone: string, text: string) => void;
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="mb-2 text-[11px] font-bold text-slate-800">{title}</p>
      {children}
    </div>
  );
}

function Btn({
  children,
  onClick,
  primary,
  disabled,
  href,
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  href?: string;
  testId?: string;
}) {
  const cls = primary
    ? 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50'
    : 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
  if (href) {
    return (
      <a href={href} className={cls} data-testid={testId}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} data-testid={testId}>
      {children}
    </button>
  );
}

function WaBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const cls = primary
    ? 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#1ebe5d] disabled:opacity-50'
    : 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      <WhatsAppIcon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function formatScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '—';
  return (Math.round(score * 10) / 10).toFixed(1);
}

function formatCost(cost: number | null | undefined): string {
  if (cost == null || !Number.isFinite(cost)) return '—';
  return `${Number(cost).toLocaleString('tr-TR')} TL`;
}

export function CallPhone({ phone, className }: { phone: string | null | undefined; className?: string }) {
  const raw = (phone ?? '').trim();
  const href = `tel:${raw.replace(/[^\d+]/g, '')}`;
  if (!raw || href === 'tel:') return raw ? <span className={className}>{raw}</span> : null;
  return (
    <a href={href} className={className ?? 'font-medium text-brand-600 hover:underline'}>
      {raw}
    </a>
  );
}

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  function commit(raw: string) {
    const n = parseTrAmount(raw);
    if (n == null) {
      onChange(raw);
      return;
    }
    onChange(n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }
  return (
    <label className="text-[11px] font-semibold text-slate-600">
      {label}
      <span className="relative mt-1 block">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => commit(value)}
          inputMode="decimal"
          className="w-full rounded-lg border border-slate-200 py-2 pl-2.5 pr-8 text-xs tabular-nums"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500">
          TL
        </span>
      </span>
    </label>
  );
}

function VendorPayConfirm(p: PlannerStepBodyProps) {
  const [draft, setDraft] = useState<boolean | null>(null);
  const locked = Boolean(p.financeSent);
  const shown = draft ?? p.vendorPaid ?? null;
  const needsConfirm = draft !== null && draft !== p.vendorPaid;
  const vendorName = p.assignedVendor?.name || 'Atanan tedarikçi';
  const alisLabel = p.alis.trim() || '—';
  return (
    <Card title="Tedarikçi ödemesi">
      <p className="text-[11px] text-slate-500">
        Bu kayıt finansa gider. Yanlış seçim ödeme yapılmış veya yapılmamış görünür. Seçimden sonra onay şarttır.
      </p>
      <div className="mt-2 flex gap-2" data-testid="acil-odeme-evet-hayir">
        <Btn
          primary={shown === true}
          disabled={locked}
          onClick={() => setDraft(true)}
        >
          Ödendi
        </Btn>
        <Btn
          primary={shown === false}
          disabled={locked}
          onClick={() => setDraft(false)}
        >
          Ödenmedi
        </Btn>
      </div>
      {needsConfirm && !locked ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2" data-testid="acil-odeme-onay">
          <p className="text-[11px] font-semibold text-amber-900">
            {vendorName} · alış {alisLabel} TL
          </p>
          <p className="mt-1 text-[11px] text-amber-800">
            {draft
              ? 'Hakediş ödendi olarak kaydedilecek. Emin misiniz?'
              : 'Hakediş ödenmedi olarak kaydedilecek. Emin misiniz?'}
          </p>
          <div className="mt-2 flex gap-1.5">
            <Btn
              primary
              onClick={() => {
                if (draft === null) return;
                p.onVendorPaid?.(draft);
                setDraft(null);
              }}
            >
              Evet, kaydı onayla
            </Btn>
            <Btn onClick={() => setDraft(null)}>Vazgeç</Btn>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-700">
          {p.vendorPaid === true
            ? 'Kayıt: ödendi.'
            : p.vendorPaid === false
              ? 'Kayıt: ödenmedi.'
              : 'Henüz onaylı kayıt yok.'}
          {locked ? ' Finansa aktarıldı; değiştirilemez.' : ''}
        </p>
      )}
    </Card>
  );
}

function KarZararOzeti({ alis, satis }: { alis: string; satis: string }) {
  const r = calcAlisSatisKar(alis, satis);
  if (!r) return null;
  const profit = r.kar >= 0;
  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${
        profit ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}
      data-testid="kar-zarar-ozet"
    >
      {profit ? (
        <TrendingUp className="h-4 w-4 text-emerald-700" />
      ) : (
        <TrendingDown className="h-4 w-4 text-red-700" />
      )}
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${profit ? 'text-emerald-900' : 'text-red-900'}`}>
          {profit ? 'Kâr' : 'Zarar'} {formatTryAmount(Math.abs(r.kar), { fractionDigits: 0 })}
        </p>
        <p className={`text-[11px] ${profit ? 'text-emerald-700' : 'text-red-700'}`}>
          %{r.pct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
        </p>
      </div>
    </div>
  );
}

function scorePct(v: VendorRecommendation): string {
  if (v.compositeScore == null || !Number.isFinite(v.compositeScore)) return '—';
  const pct = v.compositeScore <= 1 ? Math.round(v.compositeScore * 100) : Math.round(v.compositeScore);
  return `%${pct}`;
}

function formatVatTl(n: number): string {
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}

function FinanceVatBlock({
  alis,
  satis,
  alisVatMode,
  satisVatMode,
}: {
  alis: string;
  satis: string;
  alisVatMode?: VatMode;
  satisVatMode?: VatMode;
}) {
  const alisParts = calcVatBreakdown(parseTrAmount(alis) ?? Number.NaN, alisVatMode ?? 'dahil');
  const satisParts = calcVatBreakdown(parseTrAmount(satis) ?? Number.NaN, satisVatMode ?? 'dahil');
  const col = (title: string, parts: ReturnType<typeof calcVatBreakdown>, testId: string) => (
    <div data-testid={testId}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {parts ? (
        <dl className="mt-1 space-y-0.5">
          <div className="flex justify-between gap-2">
            <dt className="text-[10px] text-slate-500">KDV hariç</dt>
            <dd className="text-[11px] font-medium tabular-nums text-slate-800">{formatVatTl(parts.net)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[10px] font-medium text-slate-600">KDV (%{STANDARD_VAT_RATE})</dt>
            <dd className="text-[11px] font-semibold tabular-nums text-slate-900">{formatVatTl(parts.vat)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[10px] text-slate-500">KDV dahil</dt>
            <dd className="text-[11px] font-medium tabular-nums text-slate-800">{formatVatTl(parts.gross)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-1 text-[11px] text-slate-400">—</p>
      )}
    </div>
  );
  return (
    <div
      className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
      data-testid="acil-finans-kdv"
    >
      <p className="text-[10px] font-semibold text-slate-600">KDV ayrıntısı · oran %{STANDARD_VAT_RATE}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {col('Satış faturası', satisParts, 'acil-finans-kdv-satis')}
        {col('Alış', alisParts, 'acil-finans-kdv-alis')}
      </div>
    </div>
  );
}

function BudgetCard(p: PlannerStepBodyProps) {
  return (
    <Card title="Bu dosyanın bütçesi">
      <div className="grid grid-cols-2 gap-2">
        <AmountField label="Alış" value={p.alis} onChange={p.onAlis} />
        <AmountField label="Satış" value={p.satis} onChange={p.onSatis} />
      </div>
      <p className="mt-1 text-[10px] text-slate-400">Rakamlar TL. Binlik ayırıcı nokta, ondalık virgül (3.200,00).</p>
      <KarZararOzeti alis={p.alis} satis={p.satis} />
    </Card>
  );
}

export function PlannerStepBody(p: PlannerStepBodyProps) {
  const [showOther, setShowOther] = useState(false);
  const featured = p.vendors.slice(0, 3);
  const others = p.vendors.slice(3);

  if (p.step === 'ihbar') {
    return (
      <div className="space-y-3">
        <Card title="İhbar özeti">
          <p className="text-[11px] text-slate-500">Müşteri mailinden içeri aktarılan kayıt.</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{p.file.insured}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            <CallPhone phone={p.file.phone} className="font-medium text-brand-600 hover:underline" /> · {p.file.subject}
          </p>
          <p className="mt-2 text-xs leading-snug text-slate-700">{p.address}</p>
          <p className="mt-2 text-[11px] text-slate-700" data-testid="acil-ihbar-tarihi">
            <span className="font-semibold text-slate-800">İhbar tarihi:</span> {p.file.ihbarDate || '—'}
            <span className="mt-0.5 block text-slate-500">Mailin geldiği tarih ve saat</span>
          </p>
          {p.file.appointmentDate && p.file.appointmentDate !== '—' ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Randevu {p.file.appointmentDate} {p.file.appointmentTime}
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  if (p.step === 'tedarikci_maliyet') {
    return (
      <div className="space-y-3">
        <Card title="Atanan">
          {p.assignedVendor ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2">
              <p className="text-sm font-semibold text-emerald-950">{p.assignedVendor.name}</p>
              <p className="mt-0.5 text-[11px] text-emerald-800">
                <CallPhone phone={p.assignedVendor.phone} className="font-medium text-emerald-800 hover:underline" /> · {p.assignedVendor.district} · Skor {scorePct(p.assignedVendor)}
              </p>
            </div>
          ) : (
            <p className="text-xs font-medium text-amber-800">Önce tedarikçiyi atayın. Aşağıdan seçin.</p>
          )}
        </Card>
        {p.skipVendorPicker ? null : (
          <Card title="Önerilen tedarikçiler">
            <p className="mb-2 text-[11px] text-slate-500">İlk 3 açık. Diğer kayıtlılar kapalı.</p>
            <div className="space-y-1.5">
              {featured.map((v) => {
                const selected = p.assigned === v.id;
                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      selected ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900">
                        {v.name}{' '}
                        <span className="font-medium text-slate-500">{scorePct(v)}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {v.district} · Kalite {formatScore(v.avgServiceScore)} · {formatCost(v.avgCost)}
                      </p>
                    </div>
                    {selected ? (
                      <span className="text-[11px] font-semibold text-emerald-700">Atandı</span>
                    ) : (
                      <Btn primary onClick={() => p.onAssign(v.id)}>Ata</Btn>
                    )}
                  </div>
                );
              })}
            </div>
            {others.length > 0 ? (
              <div className="mt-2">
                <button type="button" className="text-[11px] font-semibold text-slate-600" onClick={() => setShowOther((v) => !v)}>
                  {showOther ? 'Diğerlerini gizle' : `Diğer kayıtlılar (${others.length})`}
                </button>
                {showOther
                  ? others.map((v) => (
                      <div key={v.id} className="mt-1.5 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                        <p className="text-xs text-slate-800">{v.name}</p>
                        <Btn onClick={() => p.onAssign(v.id)}>Ata</Btn>
                      </div>
                    ))
                  : null}
              </div>
            ) : null}
          </Card>
        )}
        {p.assignedVendor ? (
          <Card title="Atanan tedarikçi ve skor">
            <div className="flex items-start gap-2">
              <UserRound className="mt-0.5 h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{p.assignedVendor.name}</p>
                <p className="text-[11px] text-slate-500">
                  <Phone className="mr-1 inline h-3 w-3" />
                  <CallPhone phone={p.assignedVendor.phone} className="font-medium text-brand-600 hover:underline" /> · {p.assignedVendor.district}
                </p>
              </div>
            </div>
          </Card>
        ) : null}
        <BudgetCard {...p} />
        <Card title="WhatsApp">
          <WaBtn
            primary
            disabled={!p.assignedVendor}
            onClick={() =>
              p.assignedVendor &&
              p.onWhatsApp(
                'Tedarikçi',
                p.assignedVendor.phone ?? '',
                p.vendorWhatsAppText
                  || `${p.file.fileNo} ${p.file.subject}. Adres: ${p.address}.`,
              )
            }
          >
            Dosya bilgilerini gönder
          </WaBtn>
          {p.assignedVendor && !p.assignedVendor.phone ? (
            <p className="mt-1.5 text-[11px] text-slate-500">Tedarikçi numarası yok; sohbeti siz seçersiniz.</p>
          ) : null}
        </Card>
      </div>
    );
  }

  if (p.step === 'onay') {
    const badge =
      p.approvalState === 'onaylandi'
        ? 'Onaylandı'
        : p.approvalState === 'reddedildi'
          ? 'Reddedildi'
          : 'Onay bekleniyor';
    const badgeCls =
      p.approvalState === 'onaylandi'
        ? 'bg-emerald-50 text-emerald-800'
        : p.approvalState === 'reddedildi'
          ? 'bg-red-50 text-red-800'
          : 'bg-amber-50 text-amber-800';
    const ch = p.customerNotifyChannel ?? 'both';
    const showWa = anaMusteriAllowsWhatsApp(ch);
    const showMail = anaMusteriAllowsEmail(ch);
    return (
      <div className="space-y-3">
        <Card title="Bedeli sun ve onay al">
          <p className="text-[11px] text-slate-500">
            Ana müşteriye göre yöntem değişir. Genel zorunluluk yoktur.
          </p>
          <fieldset className="mt-2 space-y-1.5" data-testid="acil-ana-musteri-kanal">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bu müşteri için haberleşme</p>
            {([
              { id: 'whatsapp' as const, label: 'WhatsApp' },
              { id: 'email' as const, label: 'E-posta' },
              { id: 'both' as const, label: 'WhatsApp ve e-posta' },
            ]).map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 text-xs text-slate-800">
                <input
                  type="radio"
                  name="acil-ana-musteri-kanal"
                  checked={ch === opt.id}
                  onChange={() => p.onCustomerNotifyChannel?.(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </fieldset>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>{badge}</span>
            <span className="text-[11px] text-slate-500">
              {p.approvalChannel === 'email' ? 'E-posta' : 'WhatsApp'}
            </span>
          </div>
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sunum özeti</p>
            <p className="mt-1 text-[11px] text-slate-500">Kime: {p.file.customerEmail || p.file.customer}</p>
            <p className="text-[11px] text-slate-500">Talep: {p.approvalRequestedAt}</p>
            <p className="text-[11px] text-slate-500">Karar: {p.approvalDecidedAt ?? 'Bekleniyor'}</p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-snug text-slate-800">{p.approvalText}</p>
          </div>
          <textarea
            value={p.approvalText.startsWith(ACIL_ONAY_METIN_ON_EK) ? p.approvalText : withAcilOnayMetinOnEk(p.approvalText)}
            onChange={(e) => p.onApprovalText(withAcilOnayMetinOnEk(e.target.value))}
            rows={4}
            required
            className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
            data-testid="acil-onay-metin"
          />
          {!acilOnayMetinGovde(p.approvalText).trim() ? (
            <p className="mt-1 text-[11px] text-amber-700">«Riziko adreste;» sabit kalır. Devamını yazmak zorunlu.</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {showMail ? (
              <Btn
                onClick={() => {
                  p.onApprovalChannel('email');
                  p.onCustomerEmail?.();
                }}
              >
                <Mail className="h-3 w-3" /> E-posta
              </Btn>
            ) : null}
            {showWa ? (
              <WaBtn
                onClick={() => {
                  p.onApprovalChannel('whatsapp_group');
                  p.onWhatsApp(
                    'Müşteri',
                    p.file.customerPhone || '',
                    p.approvalText.trim() || `${p.file.fileNo} hizmet bedeli onayı: ${p.satis} TL.`,
                  );
                }}
              >
                WhatsApp
              </WaBtn>
            ) : null}
          </div>
          <div className="mt-3 flex gap-1.5">
            <Btn primary disabled={!acilOnayMetinGovde(p.approvalText).trim()} onClick={() => p.onApprovalState('onaylandi')}>Onayı kaydet</Btn>
            <Btn onClick={() => p.onApprovalState('reddedildi')}>Red</Btn>
          </div>
        </Card>
        <Card title="Servis onay formu">
          <p className="text-[11px] text-slate-500" data-testid="acil-onay-dijital-evrak">
            {isAcilDigitalApprovalRequired()
              ? 'Acil’de muvafakatname yok. Dijital onay bu forma alınır. Vazgeçilmez.'
              : '28.08.2026 18:01’e kadar dijital onay zorunlu değil. Form durur; işlem kesilmez.'}
          </p>
          {p.digitalDocsOk ? (
            <p className="mt-2 text-xs font-semibold text-emerald-700">Dijital onay tamam.</p>
          ) : isAcilDigitalApprovalRequired() ? (
            <p className="mt-2 text-xs font-semibold text-amber-800">Servis onay formu bekleniyor.</p>
          ) : (
            <p className="mt-2 text-xs font-semibold text-slate-600">Zorunluluk 18:01’de geri gelir.</p>
          )}
        </Card>
        <Card title="Sigortalı bilgilendirme">
          <p className="text-[11px] text-slate-500">Sigortalı hattı WhatsApp. Onay sonrası haber verilir.</p>
          <div className="mt-2">
            <WaBtn
              primary
              onClick={() => {
                if (p.onInsuredNotify) p.onInsuredNotify();
                else {
                  p.onWhatsApp(
                    'Sigortalı',
                    p.file.phone,
                    `${p.file.fileNo} onay alındı. Operasyon başlıyor.`,
                  );
                }
              }}
            >
              Sigortalı — WhatsApp
            </WaBtn>
          </div>
          {p.file.workStartedAt ? (
            <p className="mt-1.5 text-[11px] text-slate-500">İşe başlama kaydı · {p.file.workStartedAt}</p>
          ) : null}
        </Card>
      </div>
    );
  }

  if (p.step === 'kapanis') {
    return (
      <div className="space-y-3">
        <Card title="Tedarikçiden gelen görüntüler">
          <p className="mb-2 text-[11px] text-slate-500">
            Gelen kutuya düşen resimler kapanış kontrolüne sayılır. Eksikse buradan da yüklenir.
            {(p.inboxPhotoCount ?? 0) > 0
              ? ` Gelen kutuda ${p.inboxPhotoCount} görüntü var.`
              : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {p.photos.map((ph) => (
              <div key={ph.at + ph.url} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={ph.label} className="h-28 w-full object-cover" />
                <div className="px-2 py-1.5">
                  <p className="text-[11px] font-medium text-slate-800">{ph.label}</p>
                  <p className="text-[10px] text-emerald-700">WhatsApp · {ph.at}</p>
                </div>
              </div>
            ))}
            {p.photos.length === 0 ? (
              <p className="col-span-2 text-[11px] text-slate-500">Henüz kapanış görüntüsü yok.</p>
            ) : null}
          </div>
        </Card>
        <Card title="Hizmet verilme">
          <label className="flex items-center gap-2 text-xs text-slate-800" data-testid="acil-hizmet-verildi">
            <input
              type="checkbox"
              checked={Boolean(p.serviceDone)}
              disabled={Boolean(p.serviceDone) || p.approvalState !== 'onaylandi'}
              onChange={(e) => {
                if (e.target.checked) p.onServiceComplete?.(true);
              }}
            />
            Hizmet Verildi
          </label>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            {p.serviceDone
              ? `Hizmet kaydı${p.file.serviceDeliveredAt ? ` · ${p.file.serviceDeliveredAt}` : ''} tutuldu.`
              : p.approvalState === 'onaylandi'
                ? 'Sahada iş bitince işaretleyin. Tarih ve saat dosyaya yazılır.'
                : 'Önce onay talep akışı tamamlansın.'}
          </p>
        </Card>
        <Card title="Dosya kapanışı">
          {p.fileClosed ? (
            <p className="text-xs font-semibold text-emerald-700">
              Dosya kapatıldı{p.file.closedAt ? ` · ${p.file.closedAt}` : ''}. Ana müşteriye kapanış maili otomatik gider.
            </p>
          ) : (
            <Btn primary disabled={p.approvalState !== 'onaylandi'} onClick={p.onCloseFile}>
              Dosyayı kapat
            </Btn>
          )}
          {p.approvalState !== 'onaylandi' ? (
            <p className="mt-1 text-[11px] text-amber-700">Önce onay talep akışı tamamlansın.</p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">Kapatınca ana müşteriye kapanış maili otomatik gider.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Btn onClick={() => p.onClosureEmail?.()}>
              <Mail className="h-3 w-3" /> Kapanış e-postasını tekrar gönder
            </Btn>
            {anaMusteriAllowsWhatsApp(p.customerNotifyChannel ?? 'both') ? (
              <WaBtn
                onClick={() =>
                  p.onWhatsApp(
                    'Müşteri',
                    p.file.customerPhone || '',
                    `${p.file.fileNo} hizmet tamamlandı.`,
                  )
                }
              >
                Müşteri WhatsApp
              </WaBtn>
            ) : null}
          </div>
        </Card>
        {p.fileClosed ? (
          <Card title="Anket (tercihli)">
            <p className="text-[11px] text-slate-500">Dosya kapandıktan sonra gönderilebilir. Kapatmayı kilitlemez.</p>
            <div className="mt-2">
              <WaBtn
                onClick={() => {
                  if (p.onClosureSurvey) p.onClosureSurvey();
                  else {
                    p.onWhatsApp(
                      'Sigortalı',
                      p.file.phone,
                      `${p.file.fileNo} hizmet tamamlandı. Değerlendirme anketi.`,
                    );
                  }
                }}
              >
                Anket mesajı
              </WaBtn>
            </div>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <VendorPayConfirm {...p} />
      <Card title="Finans aktarım özeti">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[10px] text-slate-400">Dosya</p>
            <p className="font-semibold text-slate-800">{p.file.fileNo}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Dosya konusu</p>
            <p className="font-semibold text-slate-800">{p.file.subject || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Hakediş ödeme</p>
            <p className="font-semibold text-slate-800">
              {p.vendorPaid === true ? 'Ödendi' : p.vendorPaid === false ? 'Ödenmedi' : 'Kayıt yok'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Aktarım saati</p>
            <p className="font-semibold text-slate-800">{p.financeAt ?? 'Henüz yok'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Hakediş saati</p>
            <p className="font-semibold text-slate-800">{p.hakedisAt ?? 'Henüz yok'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Vade</p>
            <p className="font-semibold text-slate-800">Yok</p>
          </div>
        </div>
        <FinanceVatBlock
          alis={p.alis}
          satis={p.satis}
          alisVatMode={p.alisVatMode}
          satisVatMode={p.satisVatMode}
        />
        <KarZararOzeti alis={p.alis} satis={p.satis} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {!p.financeSent ? (
            <Btn
              primary
              disabled={!p.fileClosed || (p.vendorPaid !== true && p.vendorPaid !== false)}
              onClick={p.onFinance}
            >
              <Wallet className="h-3.5 w-3.5" /> Finansa aktar
            </Btn>
          ) : (
            <p className="text-xs font-semibold text-emerald-700">Aktarım kaydedildi.</p>
          )}
          {p.canOpenFinancePage ? (
            <Btn href="/panel/acil-yardim/finans#tedarikci-hakedis" testId="acil-finans-sayfasini-ac">
              Finans sayfasını aç
            </Btn>
          ) : null}
        </div>
        {!p.fileClosed ? (
          <p className="mt-2 text-[11px] text-amber-700">Önce kapanış sayfasından dosyayı kapatın.</p>
        ) : null}
        <div data-testid="acil-hakedis-kayit" className="mt-2">
          {p.hakedisAt ? (
            <>
              <p className="text-xs font-semibold text-emerald-700">Bu dosyanın tedarikçisine hakediş verildi.</p>
              <p className="mt-1 text-[11px] text-slate-600">Verilme: {p.hakedisAt}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-700">Vade uygulanmaz.</p>
            </>
          ) : (
            <p className="text-[11px] text-amber-700">Finansa aktarımda hakediş verilir.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
