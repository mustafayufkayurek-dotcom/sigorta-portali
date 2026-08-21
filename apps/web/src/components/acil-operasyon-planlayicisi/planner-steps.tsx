'use client';

/**
 * Acil planlayıcı adım içerikleri — canlı + lokal önizleme ortak.
 * Canlı 8 aşama (ACIL_STAGES) durur; operatör ekranı birleşik sayfalardır.
 */

import { useState, type ReactNode } from 'react';
import { MessageCircle, Phone, TrendingDown, TrendingUp, UserRound, Wallet } from 'lucide-react';
import { calcAlisSatisKar, formatTryAmount, parseTrAmount } from '@/utils/format-try-amount';
import type { VendorRecommendation } from '@/utils/emergencyApi';
import type { AcilStageKey } from '@/app/panel/acil-yardim/[id]/acil-workflow';

export type OperatorStepKey =
  | 'ihbar'
  | 'tedarikci_saha'
  | 'maliyet'
  | 'onay'
  | 'kapanis'
  | 'finans';

export const OPERATOR_STEPS: Array<{
  key: OperatorStepKey;
  label: string;
  hint: string;
  stageKeys: AcilStageKey[];
}> = [
  { key: 'ihbar', label: 'İhbar', hint: 'Kayıt ve ilk WhatsApp', stageKeys: ['ihbar'] },
  {
    key: 'tedarikci_saha',
    label: 'Tedarikçi Ve İşe Başlama',
    hint: 'Atama + mesaj + saha',
    stageKeys: ['tedarikci_atandi', 'ise_baslama'],
  },
  { key: 'maliyet', label: 'Tedarikçi Maliyeti', hint: 'Atanan ve skor', stageKeys: ['maliyet_alindi'] },
  { key: 'onay', label: 'Müşteri Onayı', hint: 'Mail / sistem izleme', stageKeys: ['asistans_onayi_bekleniyor'] },
  {
    key: 'kapanis',
    label: 'Hizmet Ve Kapanış',
    hint: 'WhatsApp foto + kapat',
    stageKeys: ['hizmet_tamamlandi', 'dosya_kapatildi'],
  },
  { key: 'finans', label: 'Finansa Aktarım', hint: 'Özet ve finans sayfası', stageKeys: ['finansa_aktarildi'] },
];

export type ApprovalChannel = 'email' | 'system';
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
    appointmentDate: string;
    appointmentTime: string;
  };
  address: string;
  vendors: VendorRecommendation[];
  assigned: string | null;
  assignedVendor: VendorRecommendation | null;
  alis: string;
  satis: string;
  workStartOk: boolean;
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
  onAssign: (id: string) => void;
  onAlis: (v: string) => void;
  onSatis: (v: string) => void;
  onWorkStart: (v: boolean) => void;
  onCloseFile: () => void;
  onFinance: () => void;
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
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  href?: string;
}) {
  const cls = primary
    ? 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50'
    : 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
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
  return (
    <label className="text-[11px] font-semibold text-slate-600">
      {label}
      <span className="relative mt-1 block">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 py-2 pl-2.5 pr-8 text-xs tabular-nums"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500">
          TL
        </span>
      </span>
    </label>
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

const WA_PHOTOS: Array<{ at: string; label: string; url: string }> = [];

export function PlannerStepBody(p: PlannerStepBodyProps) {
  const [showOther, setShowOther] = useState(false);
  const featured = p.vendors.slice(0, 3);
  const others = p.vendors.slice(3);

  if (p.step === 'ihbar') {
    return (
      <div className="space-y-3">
        <Card title="İhbar özeti">
          <p className="text-sm font-semibold text-slate-900">{p.file.insured}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            <CallPhone phone={p.file.phone} className="font-medium text-brand-600 hover:underline" /> · {p.file.subject}
          </p>
          <p className="mt-2 text-xs leading-snug text-slate-700">{p.address}</p>
          <p className="mt-2 text-[11px] text-slate-500">
            Randevu {p.file.appointmentDate} {p.file.appointmentTime}
          </p>
        </Card>
        <Card title="WhatsApp">
          <Btn
            primary
            onClick={() =>
              p.onWhatsApp(
                'Sigortalı',
                p.file.phone,
                `${p.file.fileNo} ihbar alındı. Randevu ${p.file.appointmentDate} ${p.file.appointmentTime}.`,
              )
            }
          >
            <MessageCircle className="h-3.5 w-3.5" /> Sigortalıya ilk mesaj
          </Btn>
        </Card>
      </div>
    );
  }

  if (p.step === 'tedarikci_saha') {
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
            <p className="text-xs text-slate-500">Henüz atama yok. Aşağıdan seçin.</p>
          )}
        </Card>
        <Card title="Önerilen tedarikçiler">
          <p className="mb-2 text-[11px] text-slate-500">İlk 3 açık. Diğer kayıtlılar kapalı. Atama ve işe başlama bu sayfada.</p>
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
        <Card title="WhatsApp">
          <div className="flex flex-wrap gap-1.5">
            <Btn
              primary
              disabled={!p.assignedVendor}
              onClick={() =>
                p.assignedVendor &&
                p.onWhatsApp(
                  'Tedarikçi',
                  p.assignedVendor.phone ?? '',
                  `${p.file.fileNo} ${p.file.subject}. Adres: ${p.address}. Randevu ${p.file.appointmentDate} ${p.file.appointmentTime}.`,
                )
              }
            >
              <MessageCircle className="h-3.5 w-3.5" /> Atama mesajı
            </Btn>
            <Btn
              disabled={!p.assignedVendor}
              onClick={() =>
                p.assignedVendor &&
                p.onWhatsApp(
                  'Tedarikçi',
                  p.assignedVendor.phone ?? '',
                  `${p.file.fileNo} işe başlama. Konuma çıkabilirsiniz.`,
                )
              }
            >
              İşe başlama mesajı
            </Btn>
          </div>
          {p.waLog.length > 0 ? (
            <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-2">
              {p.waLog.slice(0, 4).map((row) => (
                <li key={row.at + row.text} className="text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800">{row.at}</span> · {row.to} — {row.text}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
        <Card title="İşe başlama">
          <label className="flex items-center gap-2 text-xs text-slate-800">
            <input type="checkbox" checked={p.workStartOk} onChange={(e) => p.onWorkStart(e.target.checked)} />
            Tedarikçi işe başladı
          </label>
        </Card>
      </div>
    );
  }

  if (p.step === 'maliyet') {
    return (
      <div className="space-y-3">
        <Card title="Atanan tedarikçi ve skor">
          {p.assignedVendor ? (
            <>
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
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ['Öneri skoru', scorePct(p.assignedVendor)],
                  ['Hizmet kalitesi', formatScore(p.assignedVendor.avgServiceScore)],
                  ['Ortalama maliyet', formatCost(p.assignedVendor.avgCost)],
                  ['Tamamlanan dosya', String(p.assignedVendor.completedFileCount ?? '—')],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                    <p className="text-[10px] text-slate-400">{label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-amber-700">Önce tedarikçi atayın.</p>
          )}
        </Card>
        <Card title="Bu dosyanın bütçesi">
          <div className="grid grid-cols-2 gap-2">
            <AmountField label="Alış" value={p.alis} onChange={p.onAlis} />
            <AmountField label="Satış" value={p.satis} onChange={p.onSatis} />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Rakamlar TL. Binlik ayırıcı nokta.</p>
          <KarZararOzeti alis={p.alis} satis={p.satis} />
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
    return (
      <div className="space-y-3">
        <Card title="Onay izleme">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>{badge}</span>
            <span className="text-[11px] text-slate-500">
              {p.approvalChannel === 'email' ? 'E-posta' : 'Müşteri sistem onayı'}
            </span>
          </div>
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {p.approvalChannel === 'email' ? 'Onay maili özeti' : 'Sistem onay özeti'}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Kime: {p.file.customerEmail}</p>
            <p className="text-[11px] text-slate-500">Talep: {p.approvalRequestedAt}</p>
            <p className="text-[11px] text-slate-500">Karar: {p.approvalDecidedAt ?? 'Bekleniyor'}</p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-snug text-slate-800">{p.approvalText}</p>
          </div>
          <textarea
            value={p.approvalText}
            onChange={(e) => p.onApprovalText(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Btn onClick={() => p.onApprovalChannel('email')}>E-posta</Btn>
            <Btn onClick={() => p.onApprovalChannel('system')}>Sistem</Btn>
            <Btn
              onClick={() =>
                p.onWhatsApp(
                  'Müşteri',
                  p.file.customerPhone,
                  `${p.file.fileNo} maliyet onayı: alış ${p.alis} TL, satış ${p.satis} TL.`,
                )
              }
            >
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </Btn>
          </div>
          <div className="mt-3 flex gap-1.5">
            <Btn primary onClick={() => p.onApprovalState('onaylandi')}>Onayı kaydet</Btn>
            <Btn onClick={() => p.onApprovalState('reddedildi')}>Red</Btn>
          </div>
        </Card>
      </div>
    );
  }

  if (p.step === 'kapanis') {
    return (
      <div className="space-y-3">
        <Card title="WhatsApp’tan gelen görüntüler">
          <p className="mb-2 text-[11px] text-slate-500">
            Tedarikçi gönderince bu sayfaya düşer. Dosya kapanışı burada yapılır.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(p.photos.length > 0 ? p.photos : WA_PHOTOS).map((ph) => (
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
              <p className="col-span-2 text-[11px] text-slate-500">Henüz kapanış görüntüsü yok. Saha tespit fotoğrafları üst bölümde.</p>
            ) : null}
          </div>
        </Card>
        <Card title="Dosya kapanışı">
          {p.fileClosed ? (
            <p className="text-xs font-semibold text-emerald-700">Dosya kapatıldı.</p>
          ) : (
            <Btn primary disabled={!p.workStartOk} onClick={p.onCloseFile}>
              Dosyayı kapat
            </Btn>
          )}
          {!p.workStartOk ? (
            <p className="mt-1 text-[11px] text-amber-700">Önce tedarikçi ve işe başlama sayfasında işe başlandı işaretlensin.</p>
          ) : null}
          <div className="mt-2">
            <Btn
              onClick={() =>
                p.onWhatsApp(
                  'Sigortalı',
                  p.file.phone,
                  `${p.file.fileNo} hizmet tamamlandı. Kapanış anketi gönderildi.`,
                )
              }
            >
              <MessageCircle className="h-3 w-3" /> Kapanış WhatsApp
            </Btn>
          </div>
        </Card>
        <Card title="Tedarikçi hakedişi">
          {p.hakedisAt ? (
            <div data-testid="acil-hakedis-kayit">
              <p className="text-xs font-semibold text-emerald-700">Bu dosyanın tedarikçisine hakediş verildi.</p>
              <p className="mt-1 text-[11px] text-slate-600">Verilme: {p.hakedisAt}</p>
              <p className="text-[11px] text-slate-600">
                Tutar: {formatTryAmount(parseTrAmount(p.alis), { fractionDigits: 0 })}
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-700">Vade uygulanmaz.</p>
            </div>
          ) : (
            <p className="text-[11px] text-amber-700">İş bitimi ve kapanışta hakediş verilir.</p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card title="Finans aktarım özeti">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[10px] text-slate-400">Dosya</p>
            <p className="font-semibold text-slate-800">{p.file.fileNo}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Aktarım saati</p>
            <p className="font-semibold text-slate-800">{p.financeAt ?? 'Henüz yok'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Hakediş</p>
            <p className="font-semibold text-slate-800">{p.hakedisAt ?? 'Henüz yok'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Vade</p>
            <p className="font-semibold text-slate-800">Yok</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Alış</p>
            <p className="font-semibold text-slate-800">
              {formatTryAmount(parseTrAmount(p.alis), { fractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Satış</p>
            <p className="font-semibold text-slate-800">
              {formatTryAmount(parseTrAmount(p.satis), { fractionDigits: 0 })}
            </p>
            </div>
          </div>
          <KarZararOzeti alis={p.alis} satis={p.satis} />
          <div className="mt-3 flex flex-wrap gap-1.5">
          {!p.financeSent ? (
            <Btn primary disabled={!p.fileClosed} onClick={p.onFinance}>
              <Wallet className="h-3.5 w-3.5" /> Finansa aktar
            </Btn>
          ) : (
            <p className="text-xs font-semibold text-emerald-700">Aktarım kaydedildi.</p>
          )}
          <Btn href="/panel/acil-yardim/finans#tedarikci-hakedis">Finans sayfasını aç</Btn>
        </div>
        {!p.fileClosed ? (
          <p className="mt-2 text-[11px] text-amber-700">Önce hizmet ve kapanış sayfasından dosyayı kapatın.</p>
        ) : null}
      </Card>
    </div>
  );
}
