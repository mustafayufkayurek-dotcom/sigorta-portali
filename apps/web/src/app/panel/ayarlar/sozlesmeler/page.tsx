'use client';

import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { useEffect, useState } from 'react';
import { DEFAULT_AGREEMENT_TEMPLATES } from '@sigorta/shared';
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


interface Agreement {
  id: string; title: string; type: string; version: string;
  isActive: boolean; content: string; createdAt: string; updatedAt: string;
}

interface AcceptanceRow {
  id: string;
  acceptedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  signature?: string | null;
  acceptedVersion?: string | null;
  titleSnapshot?: string | null;
  contentHash?: string | null;
  scrolledAt?: string | null;
  checkboxConfirmedAt?: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
}

const typeLabels: Record<string, string> = {
  kvkk: 'KVKK Aydınlatma Metni',
  gizlilik: 'Gizlilik Taahhütnamesi',
  is_sozlesmesi: 'İş Sözleşmesi',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function exportAcceptancesCsv(agreement: Agreement, rows: AcceptanceRow[]) {
  const headers = [
    'Kullanıcı', 'E-posta', 'İmza', 'Onay Versiyonu', 'Belge Başlığı',
    'İçerik Hash', 'Onay Tarihi', 'Scroll Tarihi', 'Checkbox Tarihi', 'IP', 'User-Agent',
  ];
  const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((r) => [
      escape(`${r.user.firstName} ${r.user.lastName}`.trim()),
      escape(r.user.email),
      escape(r.signature ?? ''),
      escape(r.acceptedVersion ?? ''),
      escape(r.titleSnapshot ?? agreement.title),
      escape(r.contentHash ?? ''),
      escape(r.acceptedAt),
      escape(r.scrolledAt ?? ''),
      escape(r.checkboxConfirmedAt ?? ''),
      escape(r.ipAddress ?? ''),
      escape(r.userAgent ?? ''),
    ].join(',')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sozlesme-onaylari-${agreement.type}-v${agreement.version}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SozlesmelerPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Agreement | null>(null);
  const [form, setForm] = useState({ title: '', type: 'kvkk', version: '1.0', content: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Agreement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [acceptancesTarget, setAcceptancesTarget] = useState<Agreement | null>(null);
  const [acceptances, setAcceptances] = useState<AcceptanceRow[]>([]);
  const [acceptancesLoading, setAcceptancesLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/agreements`, { headers: authHeader() });
      const json = await res.json();
      setAgreements(json?.data ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditItem(null); setForm({ title: '', type: 'kvkk', version: '1.1', content: '', isActive: true }); setError(''); setShowModal(true); }
  function openEdit(item: Agreement) { setEditItem(item); setForm({ title: item.title, type: item.type, version: item.version, content: item.content, isActive: item.isActive }); setError(''); setShowModal(true); }

  function applyTemplate() {
    if (form.type === 'kvkk') setForm((f) => ({ ...f, content: DEFAULT_AGREEMENT_TEMPLATES.kvkk }));
    else if (form.type === 'gizlilik') setForm((f) => ({ ...f, content: DEFAULT_AGREEMENT_TEMPLATES.gizlilik }));
  }

  async function openAcceptances(item: Agreement) {
    setAcceptancesTarget(item);
    setAcceptances([]);
    setAcceptancesLoading(true);
    try {
      const res = await fetch(`${API}/agreements/${item.id}/acceptances`, { headers: authHeader() });
      const json = await res.json();
      setAcceptances(json?.data ?? []);
    } finally {
      setAcceptancesLoading(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) { setError('Başlık ve içerik zorunludur.'); return; }
    setSaving(true); setError('');
    try {
      const url = editItem ? `${API}/agreements/${editItem.id}` : `${API}/agreements`;
      const method = editItem ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(form) });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.message ?? 'Kaydedilemedi'); }
      setShowModal(false); await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`${API}/agreements/${deleteTarget.id}`, { method: 'DELETE', headers: authHeader() });
      setDeleteTarget(null); await load();
    } finally { setDeleting(false); }
  }

  async function toggleActive(item: Agreement) {
    await fetch(`${API}/agreements/${item.id}`, { method: 'PATCH', headers: authHeader(), body: JSON.stringify({ isActive: !item.isActive }) });
    await load();
  }

  return (
    <SettingsPageLayout
      title="Sözleşme Yönetimi"
      description="KVKK ve gizlilik belgelerini yönetin. Şirket bilgileri Ayarlar → Kurulum → Genel Bilgiler'den otomatik doldurulur."
      addButtonText="+ Yeni Sözleşme"
      onAdd={openNew}
    >

      <SettingsTable loading={loading} empty={agreements.length === 0} emptyText="Henüz sözleşme eklenmemiş.">
        <SettingsTableHead>
          <SettingsTableTh>Başlık</SettingsTableTh>
          <SettingsTableTh>Tür</SettingsTableTh>
          <SettingsTableTh>Versiyon</SettingsTableTh>
          <SettingsTableTh>Durum</SettingsTableTh>
          <SettingsTableTh>Tarih</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {agreements.map((a) => (
            <SettingsTableRow key={a.id}>
              <SettingsTableTd><p className="text-sm font-medium text-slate-900">{a.title}</p></SettingsTableTd>
              <SettingsTableTd>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  {typeLabels[a.type] ?? a.type}
                </span>
              </SettingsTableTd>
              <SettingsTableTd>v{a.version}</SettingsTableTd>
              <SettingsTableTd>
                <button type="button" onClick={() => toggleActive(a)}>
                  <StatusBadge active={a.isActive} />
                </button>
              </SettingsTableTd>
              <SettingsTableTd className="text-xs text-slate-400">{fmtDate(a.updatedAt)}</SettingsTableTd>
              <SettingsTableActions>
                <button
                  type="button"
                  onClick={() => openAcceptances(a)}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-50"
                  title="Dijital onay kayıtları"
                >
                  Onaylar
                </button>
                <EditButton onClick={() => openEdit(a)} />
                <DeleteButton onClick={() => setDeleteTarget(a)} />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? 'Sözleşmeyi Düzenle' : 'Yeni Sözleşme'}
        onSave={handleSave} saving={saving} error={error} maxWidth="xl">
        <div>
          <label className={labelCls}>Başlık <span className="text-red-500">*</span></label>
          <input type="text" className={inputCls} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Sözleşme başlığı" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tür <span className="text-red-500">*</span></label>
            <select className={`${inputCls} bg-white`} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="kvkk">KVKK Aydınlatma Metni</option>
              <option value="gizlilik">Gizlilik Taahhütnamesi</option>
              <option value="is_sozlesmesi">İş Sözleşmesi</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Versiyon</label>
            <input type="text" className={inputCls} value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} placeholder="1.1" />
            <p className="text-xs text-amber-600 mt-1">İçerik değiştiğinde versiyonu artırın; kullanıcılar yeniden onaylar.</p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls}>İçerik (HTML) <span className="text-red-500">*</span></label>
            {!editItem && (
              <button type="button" onClick={applyTemplate} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Meridyen Şablonu Uygula
              </button>
            )}
          </div>
          <textarea className={`${inputCls} font-mono text-xs`} rows={12}
            value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="Sözleşme HTML içeriğini girin..." />
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button type="button" role="checkbox" aria-checked={form.isActive}
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-all ${form.isActive ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 hover:border-blue-400'}`}>
            {form.isActive && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className="text-sm text-slate-700">Aktif — kullanıcılardan onay istenir</span>
        </label>
      </SettingsModal>

      {/* Dijital onay kayıtları */}
      {acceptancesTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Dijital Onay Kayıtları</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {acceptancesTarget.title} — v{acceptancesTarget.version}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {acceptances.length > 0 && (
                  <button
                    type="button"
                    onClick={() => exportAcceptancesCsv(acceptancesTarget, acceptances)}
                    className="text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg"
                  >
                    CSV İndir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAcceptancesTarget(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {acceptancesLoading ? (
                <p className="text-sm text-slate-400 text-center py-8">Yükleniyor...</p>
              ) : acceptances.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Henüz onay kaydı yok.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="pb-2 pr-3">Kullanıcı</th>
                      <th className="pb-2 pr-3">İmza</th>
                      <th className="pb-2 pr-3">Versiyon</th>
                      <th className="pb-2 pr-3">Onay</th>
                      <th className="pb-2 pr-3">IP</th>
                      <th className="pb-2">Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acceptances.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-slate-900">{r.user.firstName} {r.user.lastName}</p>
                          <p className="text-xs text-slate-400">{r.user.email}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-700">{r.signature ?? '—'}</td>
                        <td className="py-2.5 pr-3 text-slate-600">{r.acceptedVersion ?? '—'}</td>
                        <td className="py-2.5 pr-3 text-xs text-slate-500">{fmtDate(r.acceptedAt)}</td>
                        <td className="py-2.5 pr-3 text-xs text-slate-400 font-mono">{r.ipAddress ?? '—'}</td>
                        <td className="py-2.5 text-xs text-slate-400 font-mono truncate max-w-[120px]" title={r.contentHash ?? ''}>
                          {r.contentHash ? `${r.contentHash.slice(0, 12)}…` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm} deleting={deleting} itemName={deleteTarget?.title} />
    </SettingsPageLayout>
  );
}
