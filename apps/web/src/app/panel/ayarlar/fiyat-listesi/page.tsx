'use client';

import { useEffect, useState, useCallback } from 'react';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  EditButton,
  DeleteButton,
  StatusBadge,
  SettingsTable,
  SettingsTableHead,
  SettingsTableTh,
  SettingsTableBody,
  SettingsTableRow,
  SettingsTableTd,
  SettingsTableActions,
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import Link from 'next/link';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { API, authHeader } from '@/utils/api';
import { applyNameWithAutoCode, blurNameWithAutoCode, suggestAutoCode } from '@/utils/auto-code';
import { normalizeFormFreeText } from '@/utils/text-helpers';


// ─── Tipler ──────────────────────────────────────────────────────────────────
type WorkSubGroup = {
  id: string;
  code: string;
  name: string;
  description?: string;
  unitType: string;
  unitPrice?: number | null;
  status: string;
  sortOrder: number;
};

type WorkGroup = {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: string;
  isSystem: boolean;
  sortOrder: number;
  workSubGroups?: WorkSubGroup[];
  _count?: { workSubGroups: number };
};

const UNIT_LABELS: Record<string, string> = {
  adet: 'Adet',
  'm²': 'm²',
  metre: 'Metre',
  saat: 'Saat',
  kg: 'KG',
  ton: 'Ton',
};

const emptyWG = { code: '', name: '', description: '', sortOrder: 0 };
const emptySG = { code: '', name: '', description: '', unitType: 'adet', unitPrice: '', sortOrder: 0, workGroupId: '' };

// ─── Sayfa ────────────────────────────────────────────────────────────────────
export default function FiyatListesiPage() {
  const [groups, setGroups] = useState<WorkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Modaller
  const [wgModal, setWgModal] = useState(false);
  const [editWG, setEditWG] = useState<WorkGroup | null>(null);
  const [wgForm, setWgForm] = useState(emptyWG);
  const [wgSaving, setWgSaving] = useState(false);
  const [wgError, setWgError] = useState('');
  const [deleteWG, setDeleteWG] = useState<WorkGroup | null>(null);

  const [sgModal, setSgModal] = useState(false);
  const [sgParentId, setSgParentId] = useState<string | null>(null);
  const [editSG, setEditSG] = useState<WorkSubGroup | null>(null);
  const [sgForm, setSgForm] = useState(emptySG);
  const [sgSaving, setSgSaving] = useState(false);
  const [sgError, setSgError] = useState('');
  const [deleteSG, setDeleteSG] = useState<WorkSubGroup & { parentId: string } | null>(null);

  const [seeding, setSeeding] = useState(false);

  // ─── Veri Yükleme ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/work-groups`, { headers: authHeader() });
      const json = await res.json();
      setGroups(json.data ?? []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Seed ──────────────────────────────────────────────────────────────────
  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch(`${API}/work-groups/seed`, { method: 'POST', headers: authHeader() });
      await load();
    } finally {
      setSeeding(false);
    }
  };

  // ─── İş Grubu CRUD ─────────────────────────────────────────────────────────
  const openAddWG = () => { setEditWG(null); setWgForm(emptyWG); setWgError(''); setWgModal(true); };
  const openEditWG = (wg: WorkGroup) => { setEditWG(wg); setWgForm({ code: wg.code, name: wg.name, description: wg.description ?? '', sortOrder: wg.sortOrder }); setWgError(''); setWgModal(true); };

  const saveWG = async () => {
    const name = normalizeFormFreeText(wgForm.name);
    if (!name) { setWgError('İş grubu adı zorunludur'); return; }
    const description = wgForm.description.trim() ? normalizeFormFreeText(wgForm.description) : '';
    const code = editWG ? wgForm.code : (wgForm.code.trim() || suggestAutoCode('WG', name));
    if (!code.trim() && !editWG) { setWgError('Kod üretilemedi'); return; }
    setWgSaving(true); setWgError('');
    try {
      const url = editWG ? `${API}/work-groups/${editWG.id}` : `${API}/work-groups`;
      const method = editWG ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...wgForm, name, description, code, sortOrder: Number(wgForm.sortOrder) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Hata oluştu');
      setWgModal(false);
      await load();
    } catch (e: any) {
      setWgError(e.message ?? 'Kayıt başarısız');
    } finally {
      setWgSaving(false);
    }
  };

  const deleteWorkGroup = async () => {
    if (!deleteWG) return;
    try {
      await fetch(`${API}/work-groups/${deleteWG.id}`, { method: 'DELETE', headers: authHeader() });
      setDeleteWG(null);
      await load();
    } catch {}
  };

  // ─── Alt Grup CRUD ─────────────────────────────────────────────────────────
  const openAddSG = (parentId: string) => { setSgParentId(parentId); setEditSG(null); setSgForm({ ...emptySG, workGroupId: parentId }); setSgError(''); setSgModal(true); };
  const openEditSG = (sg: WorkSubGroup, parentId: string) => { setSgParentId(parentId); setEditSG(sg); setSgForm({ code: sg.code, name: sg.name, description: sg.description ?? '', unitType: sg.unitType, unitPrice: sg.unitPrice != null ? String(sg.unitPrice) : '', sortOrder: sg.sortOrder, workGroupId: parentId }); setSgError(''); setSgModal(true); };

  const saveSG = async () => {
    const name = normalizeFormFreeText(sgForm.name);
    if (!name) { setSgError('Alt grup adı zorunludur'); return; }
    const description = sgForm.description.trim() ? normalizeFormFreeText(sgForm.description) : '';
    const targetGroupId = sgForm.workGroupId || sgParentId;
    if (!targetGroupId) { setSgError('İş grubu seçilmelidir'); return; }
    const parentCode = groups.find((g) => g.id === targetGroupId)?.code ?? 'WSG';
    const code = editSG ? sgForm.code : (sgForm.code.trim() || suggestAutoCode(parentCode, name));
    if (!code.trim() && !editSG) { setSgError('Kod üretilemedi'); return; }
    setSgSaving(true); setSgError('');
    try {
      const url = editSG ? `${API}/work-groups/sub-groups/${editSG.id}` : `${API}/work-groups/${targetGroupId}/sub-groups`;
      const method = editSG ? 'PUT' : 'POST';
      const payload = {
        ...sgForm,
        name,
        description,
        code,
        sortOrder: Number(sgForm.sortOrder),
        unitPrice: sgForm.unitPrice !== '' ? Number(sgForm.unitPrice) : undefined,
        workGroupId: targetGroupId,
      };
      const res = await fetch(url, {
        method,
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Hata oluştu');
      setSgModal(false);
      await load();
    } catch (e: any) {
      setSgError(e.message ?? 'Kayıt başarısız');
    } finally {
      setSgSaving(false);
    }
  };

  const deleteSubGroup = async () => {
    if (!deleteSG) return;
    try {
      await fetch(`${API}/work-groups/sub-groups/${deleteSG.id}`, { method: 'DELETE', headers: authHeader() });
      setDeleteSG(null);
      await load();
    } catch {}
  };

  // ─── Arama & Toggle ────────────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredGroups = search.trim()
    ? groups.filter((g) =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.workSubGroups?.some((s) => s.name.toLowerCase().includes(search.toLowerCase()))
      )
    : groups;

  const fmt = (n?: number | null) =>
    n != null ? n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }) : '—';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SettingsPageLayout
      title="Fiyat Listesi"
      description="İş grubu ve alt gruba göre birim fiyat tanımlama. Her alt grup bir iş grubuna bağlıdır."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <div className="flex items-center gap-2">
          <Link
            href="/panel/ayarlar/fiyat-listesi/yukle"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Excel ile Yükle
          </Link>
          {groups.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              {seeding ? 'Yükleniyor...' : 'Örnek Veri Yükle'}
            </button>
          )}
          <button
            onClick={openAddWG}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            İş Grubu Ekle
          </button>
        </div>
      }
    >
      {/* Arama */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="İş grubu veya alt grup ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">Henüz iş grubu yok</p>
          <p className="text-xs text-slate-400 mb-4">İş grubu ekleyerek başlayın veya örnek veri yükleyin.</p>
          <button onClick={handleSeed} disabled={seeding} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
            {seeding ? 'Yükleniyor...' : 'Örnek Veri Yükle'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((wg) => {
            const isOpen = expandedGroups.has(wg.id);
            const subCount = wg.workSubGroups?.length ?? wg._count?.workSubGroups ?? 0;
            return (
              <div key={wg.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

                {/* Başlık */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button
                    onClick={() => toggleExpand(wg.id)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform ${isOpen ? 'bg-blue-600' : 'bg-slate-100'}`}>
                      <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90 text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{wg.name}</span>
                        <span className="text-xs text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">{wg.code}</span>
                        {wg.isSystem && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Sistem</span>}
                      </div>
                      {wg.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{wg.description}</p>}
                    </div>
                    <span className="ml-auto text-xs text-slate-400 shrink-0">{subCount} alt grup</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openAddSG(wg.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Alt Grup Ekle
                    </button>
                    <EditButton onClick={() => openEditWG(wg)} />
                    <DeleteButton onClick={() => setDeleteWG(wg)} />
                  </div>
                </div>

                {/* Alt gruplar */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {!wg.workSubGroups || wg.workSubGroups.length === 0 ? (
                      <div className="px-6 py-6 text-center">
                        <p className="text-xs text-slate-400">Bu grupta henüz alt grup yok.</p>
                        <button onClick={() => openAddSG(wg.id)} className="mt-2 text-xs text-blue-600 hover:underline">Alt grup ekle</button>
                      </div>
                    ) : (
                      <SettingsTable>
                        <SettingsTableHead>
                          <SettingsTableTh>Alt Grup Adı</SettingsTableTh>
                          <SettingsTableTh>Birim</SettingsTableTh>
                          <SettingsTableTh>Birim Fiyat</SettingsTableTh>
                          <SettingsTableTh>Durum</SettingsTableTh>
                          <SettingsTableTh>İşlemler</SettingsTableTh>
                        </SettingsTableHead>
                        <SettingsTableBody>
                          {wg.workSubGroups.map((sg) => (
                            <SettingsTableRow key={sg.id}>
                              <SettingsTableTd>
                                <div>
                                  <span className="text-sm font-medium text-slate-900">{sg.name}</span>
                                  {sg.description && <p className="text-xs text-slate-400 mt-0.5">{sg.description}</p>}
                                </div>
                              </SettingsTableTd>
                              <SettingsTableTd>
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                  {UNIT_LABELS[sg.unitType] ?? sg.unitType}
                                </span>
                              </SettingsTableTd>
                              <SettingsTableTd>
                                <span className="text-sm font-semibold text-slate-900">{fmt(sg.unitPrice)}</span>
                              </SettingsTableTd>
                              <SettingsTableTd>
                                <StatusBadge active={sg.status !== 'inactive'} />
                              </SettingsTableTd>
                              <SettingsTableTd>
                                <SettingsTableActions>
                                  <EditButton onClick={() => openEditSG(sg, wg.id)} />
                                  <DeleteButton onClick={() => setDeleteSG({ ...sg, parentId: wg.id })} />
                                </SettingsTableActions>
                              </SettingsTableTd>
                            </SettingsTableRow>
                          ))}
                        </SettingsTableBody>
                      </SettingsTable>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* İş Grubu Modal */}
      <SettingsModal
        isOpen={wgModal}
        onClose={() => setWgModal(false)}
        title={editWG ? 'İş Grubu Düzenle' : 'Yeni İş Grubu'}
        onSave={saveWG}
        saving={wgSaving}
      >
        <div className="space-y-4">
          {wgError && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{wgError}</div>
          )}
          {!editWG && (
            <div>
              <label className={labelCls}>Kod</label>
              <input className={`${inputCls} disabled:bg-slate-50`} value={wgForm.code} disabled placeholder="Ad yazınca otomatik üretilir" />
            </div>
          )}
          <div>
            <label className={labelCls}>İş Grubu Adı <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
            <input className={inputCls} value={wgForm.name} onChange={(e) => setWgForm((f) => applyNameWithAutoCode(f, e.target.value, !!editWG, 'WG'))} onBlur={() => setWgForm((f) => blurNameWithAutoCode(f, !!editWG, 'WG'))} placeholder="Tesisat" />
          </div>
          <div>
            <label className={labelCls}>Açıklama</label>
            <input className={inputCls} value={wgForm.description} onChange={(e) => setWgForm((f) => ({ ...f, description: e.target.value }))} onBlur={(e) => { const v = normalizeFormFreeText(e.target.value); if (v !== e.target.value.trim()) setWgForm((f) => ({ ...f, description: v })); }} placeholder="İsteğe bağlı açıklama" />
          </div>
          <div>
            <label className={labelCls}>Sıra No</label>
            <input type="number" className={inputCls} value={wgForm.sortOrder} onChange={(e) => setWgForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} min={0} />
          </div>
        </div>
      </SettingsModal>

      {/* Alt Grup Modal */}
      <SettingsModal
        isOpen={sgModal}
        onClose={() => setSgModal(false)}
        title={editSG ? 'Alt Grup Düzenle' : 'Yeni Alt Grup'}
        onSave={saveSG}
        saving={sgSaving}
      >
        <div className="space-y-4">
          {sgError && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{sgError}</div>
          )}
          <div>
            <label className={labelCls}>İş Grubu *</label>
            <select
              className={`${inputCls} bg-white`}
              value={sgForm.workGroupId || sgParentId || ''}
              onChange={(e) => setSgForm((f) => ({ ...f, workGroupId: e.target.value }))}
            >
              <option value="">İş grubu seçin...</option>
              {groups.filter((g) => g.status !== 'inactive').map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          {(sgForm.workGroupId || sgParentId) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">
                  {groups.find((g) => g.id === (sgForm.workGroupId || sgParentId))?.name}
                </span>
                {' '}iş grubuna bağlanacak
              </p>
            </div>
          )}
          {!editSG && (
            <div>
              <label className={labelCls}>Kod</label>
              <input className={`${inputCls} disabled:bg-slate-50`} value={sgForm.code} disabled placeholder="Ad yazınca otomatik üretilir" />
            </div>
          )}
          <div>
            <label className={labelCls}>Alt Grup Adı <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
            <input
              className={inputCls}
              value={sgForm.name}
              onChange={(e) =>
                setSgForm((f) =>
                  applyNameWithAutoCode(
                    f,
                    e.target.value,
                    !!editSG,
                    groups.find((g) => g.id === sgParentId)?.code ?? 'WSG',
                  ),
                )
              }
              onBlur={() =>
                setSgForm((f) =>
                  blurNameWithAutoCode(
                    f,
                    !!editSG,
                    groups.find((g) => g.id === (f.workGroupId || sgParentId))?.code ?? 'WSG',
                  ),
                )
              }
              placeholder="Musluk Değişimi"
            />
          </div>
          <div>
            <label className={labelCls}>Açıklama</label>
            <input className={inputCls} value={sgForm.description} onChange={(e) => setSgForm((f) => ({ ...f, description: e.target.value }))} onBlur={(e) => { const v = normalizeFormFreeText(e.target.value); if (v !== e.target.value.trim()) setSgForm((f) => ({ ...f, description: v })); }} placeholder="İsteğe bağlı" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Birim <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
              <select className={inputCls} value={sgForm.unitType} onChange={(e) => setSgForm((f) => ({ ...f, unitType: e.target.value }))}>
                {Object.entries(UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Birim Fiyat (TL)</label>
              <input type="number" className={inputCls} value={sgForm.unitPrice} onChange={(e) => setSgForm((f) => ({ ...f, unitPrice: e.target.value }))} placeholder="0.00" min={0} step="0.01" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Sıra No</label>
            <input type="number" className={inputCls} value={sgForm.sortOrder} onChange={(e) => setSgForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} min={0} />
          </div>
        </div>
      </SettingsModal>

      {/* Silme Onayı — İş Grubu */}
      <DeleteConfirmDialog
        isOpen={!!deleteWG}
        onClose={() => setDeleteWG(null)}
        onConfirm={deleteWorkGroup}
        itemName={deleteWG?.name ?? ''}
      />

      {/* Silme Onayı — Alt Grup */}
      <DeleteConfirmDialog
        isOpen={!!deleteSG}
        onClose={() => setDeleteSG(null)}
        onConfirm={deleteSubGroup}
        itemName={deleteSG?.name ?? ''}
      />
    </SettingsPageLayout>
  );
}
