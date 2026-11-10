'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { SettingsFieldLabel, inputCls } from '@/components/settings/SettingsUI';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { API, authHeader } from '@/utils/api';
import { formatSettingsApiError } from '@/utils/settings-api';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { CONSULTANCY_SERVICE_FAMILY, parseServiceTypeListPayload } from '@sigorta/shared';
import {
  CLAIM_MAIL_PARTY_LABEL,
  type ClaimMailParty,
  HIZMET_GROUP_LABEL,
  HIZMET_STEP_LABEL,
  hizmetCodeFromName,
  mergeHizmetKartlari,
  type HizmetGroup,
  type HizmetKarti,
  type HizmetStep,
} from '@sigorta/shared';

const PARTIES: ClaimMailParty[] = ['insurance', 'agency', 'broker', 'expert'];
const REQUIRED: Array<{ id: HizmetKarti['requiredParties'][number]; label: string }> = [
  { id: 'insurance', label: 'Sigorta Şirketi' },
  { id: 'broker', label: 'Broker' },
  { id: 'expert', label: 'Eksper' },
];

function toggleParty<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function partyNames(ids: ClaimMailParty[]): string {
  if (!ids.length) return 'yok';
  return ids.map((id) => CLAIM_MAIL_PARTY_LABEL[id]).join(', ');
}

function requiredNames(card: HizmetKarti): string {
  if (!card.requiredParties.length) return 'yok';
  return REQUIRED.filter((item) => card.requiredParties.includes(item.id)).map((item) => item.label).join(', ');
}

function outcomeLines(card: HizmetKarti): string[] {
  const place = card.menuVisible
    ? `${HIZMET_GROUP_LABEL[card.group]} menüsünde durur`
    : 'menüde görünmez';
  return [
    `${card.name} ${place}. Dosya ${HIZMET_STEP_LABEL[card.steps]} adımıyla yürür. ${card.reportPrice ? 'Raporda fiyat vardır.' : 'Raporda fiyat yoktur.'}`,
    `Onay maili: ${partyNames(card.approvalParties)}. Yazışma maili: ${partyNames(card.correspondenceParties)}.`,
    `Yeni dosyada zorunlu taraf: ${requiredNames(card)}.`,
  ];
}

export default function HizmetKartlariPage() {
  const [rows, setRows] = useState<HizmetKarti[]>(() => mergeHizmetKartlari(null));
  const [selected, setSelected] = useState('danismanlik');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<HizmetGroup>('asistans');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cardsRes, typesRes] = await Promise.all([
        axios.get(`${API}/system-settings/hizmet-kartlari`, { headers: authHeader() }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/service-types`, {
          headers: authHeader(),
          params: { family: CONSULTANCY_SERVICE_FAMILY },
        }).catch(() => ({ data: [] })),
      ]);
      const saved = cardsRes.data?.data ?? [];
      const extras = parseServiceTypeListPayload(typesRes.data)
        .filter((row) => row.isActive !== false && row.name && row.code)
        .map((row) => ({ name: row.name, code: row.code, group: 'ek' as const }));
      const next = mergeHizmetKartlari(saved, extras);
      setRows(next);
      setSelected((current) => (next.some((row) => row.code === current) ? current : next[0]?.code ?? 'danismanlik'));
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const card = rows.find((row) => row.code === selected) ?? rows[0];

  const groups = useMemo(() => (['asistans', 'ek'] as HizmetGroup[]).map((group) => ({
    group,
    rows: rows.filter((row) => row.group === group),
  })), [rows]);

  const patch = (next: Partial<HizmetKarti>) => {
    if (!card) return;
    setSavedNote('');
    setRows((list) => list.map((row) => (row.code === card.code ? { ...row, ...next } : row)));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSavedNote('');
    try {
      await axios.put(`${API}/system-settings/hizmet-kartlari`, { values: rows }, { headers: authHeader() });
      setSavedNote('Kaydedildi. Menüde görünen yeni hizmet, sol menüde kendi grubunun altında durur.');
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const addService = () => {
    const name = toTitleCaseTR(newName.trim());
    if (!name) {
      setError('Hizmet adı yazın.');
      return;
    }
    let code = hizmetCodeFromName(name);
    if (rows.some((row) => row.code === code)) code = `${code}-2`;
    const next: HizmetKarti = {
      code,
      name,
      group: newGroup,
      menuVisible: true,
      steps: newGroup === 'asistans' ? 'hasar' : 'danismanlik',
      reportPrice: true,
      approvalParties: ['broker'],
      correspondenceParties: ['broker'],
      requiredParties: [],
    };
    setRows((list) => [...list, next]);
    setSelected(code);
    setNewName('');
    setError('');
    setSavedNote('');
  };

  return (
    <SettingsPageLayout
      title="Hizmet Kartları"
      description="Asistans ve ek hizmetlerin menüsü, adımı ve maili buradan ayarlanır. Dosya açılırken sorulmaz."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
    >
      <div className="space-y-4">
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        {savedNote ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedNote}</p> : null}

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            {loading ? <p className="px-1 py-2 text-sm text-slate-500">Yükleniyor</p> : null}
            {groups.map((block) => (
              <div key={block.group} className="mb-3">
                <p className="px-1 pb-1 text-xs font-semibold text-slate-500">{HIZMET_GROUP_LABEL[block.group]}</p>
                <div className="space-y-1">
                  {block.rows.map((row) => {
                    const on = row.code === card?.code;
                    return (
                      <button
                        key={row.code}
                        type="button"
                        onClick={() => setSelected(row.code)}
                        className={`w-full rounded-lg border px-2.5 py-2 text-left ${
                          on ? 'border-brand-600 bg-brand-50' : 'border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <span className={`block text-sm ${on ? 'font-semibold text-brand-800' : 'font-medium text-slate-900'}`}>{row.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {row.menuVisible ? `Onay: ${partyNames(row.approvalParties)}` : 'Menüde gizli'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <SettingsFieldLabel help="Yeni hizmet, seçilen grubun altında sol menüde görünür.">
                Yeni Hizmet
              </SettingsFieldLabel>
              <input
                className={inputCls}
                value={newName}
                placeholder="Örn. cam işleri"
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => {
                  const v = toTitleCaseTR(newName.trim());
                  if (v && v !== newName) setNewName(v);
                }}
              />
              <select className={inputCls} value={newGroup} onChange={(e) => setNewGroup(e.target.value as HizmetGroup)}>
                <option value="asistans">{HIZMET_GROUP_LABEL.asistans}</option>
                <option value="ek">{HIZMET_GROUP_LABEL.ek}</option>
              </select>
              <button type="button" onClick={addService} className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Hizmet Ekle
              </button>
            </div>
          </section>

          {card ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div key={card.code} className="rounded-lg bg-slate-50 px-3 py-2.5">
                {outcomeLines(card).map((line) => (
                  <p key={line} className="text-sm leading-5 text-slate-700">{line}</p>
                ))}
              </div>

              <div className="mt-4 grid items-start gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                <SwitchGroup title="Menü Ve Rapor" help="Açık olan uygulanır.">
                  <SwitchRow label="Menüde Görünsün" on={card.menuVisible} onToggle={() => patch({ menuVisible: !card.menuVisible })} />
                  <SwitchRow label="Raporda Fiyat" on={card.reportPrice} onToggle={() => patch({ reportPrice: !card.reportPrice })} />
                </SwitchGroup>

                <div>
                  <SettingsFieldLabel help={card.fixed ? 'Bu hizmetin adımı durur.' : 'Yeni hizmet menüde bu adıma açılır.'}>Dosya Adımı</SettingsFieldLabel>
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                    {(Object.keys(HIZMET_STEP_LABEL) as HizmetStep[]).map((step) => {
                      const on = card.steps === step;
                      return (
                        <button
                          key={step}
                          type="button"
                          aria-pressed={on}
                          disabled={card.fixed}
                          onClick={() => { if (!card.fixed) patch({ steps: step }); }}
                          className={`rounded-md px-2.5 py-1.5 text-sm ${
                            on ? 'bg-brand-600 font-semibold text-white' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {HIZMET_STEP_LABEL[step]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <SwitchGroup title="Onay Maili" help="Açık olan taraf onay mailini alır.">
                  {PARTIES.map((id) => (
                    <SwitchRow
                      key={id}
                      label={CLAIM_MAIL_PARTY_LABEL[id]}
                      on={card.approvalParties.includes(id)}
                      onToggle={() => patch({ approvalParties: toggleParty(card.approvalParties, id) })}
                    />
                  ))}
                </SwitchGroup>

                <SwitchGroup title="Yazışma Maili" help="Açık olan taraf yazışmayı ve kapanışı alır.">
                  {PARTIES.map((id) => (
                    <SwitchRow
                      key={id}
                      label={CLAIM_MAIL_PARTY_LABEL[id]}
                      on={card.correspondenceParties.includes(id)}
                      onToggle={() => patch({ correspondenceParties: toggleParty(card.correspondenceParties, id) })}
                    />
                  ))}
                </SwitchGroup>

                <SwitchGroup title="Yeni Dosyada Zorunlu" help="Açık olan taraf boş bırakılamaz.">
                  {REQUIRED.map((item) => (
                    <SwitchRow
                      key={item.id}
                      label={item.label}
                      on={card.requiredParties.includes(item.id)}
                      onToggle={() => patch({ requiredParties: toggleParty(card.requiredParties, item.id) })}
                    />
                  ))}
                </SwitchGroup>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                {card.fixed ? <span /> : (
                  <button
                    type="button"
                    onClick={() => {
                      setRows((list) => list.filter((row) => row.code !== card.code));
                      setSelected('danismanlik');
                      setSavedNote('');
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Hizmeti Kaldır
                  </button>
                )}
                <button type="button" onClick={() => void save()} disabled={saving} className="ml-auto rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {saving ? 'Kaydediliyor' : 'Kaydet'}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </SettingsPageLayout>
  );
}

function SwitchGroup({ title, help, children }: { title: string; help: string; children: ReactNode }) {
  return (
    <div className="w-fit">
      <SettingsFieldLabel help={help}>{title}</SettingsFieldLabel>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SwitchRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-md py-1 text-left"
    >
      <span className={`min-w-[9.5rem] text-sm ${on ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{label}</span>
      <span className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}
