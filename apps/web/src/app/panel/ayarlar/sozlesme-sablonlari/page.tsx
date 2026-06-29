'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { sanitizeHtml } from '@/utils/sanitize-html';
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
import type { TableColumnDef } from '@/components/ui/TableColumnPicker';
import { SettingsTableColumnsProvider, SettingsTableColumnPicker } from '@/components/settings/SettingsTableColumns';

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'name', label: 'Şablon Adı', defaultWidth: 200, minWidth: 120 },
  { id: 'type', label: 'Tür', defaultWidth: 120, minWidth: 90 },
  { id: 'description', label: 'Açıklama', defaultWidth: 180, minWidth: 100 },
  { id: 'status', label: 'Durum', defaultWidth: 100, minWidth: 80 },
];

const CONTRACT_TYPES = [
  { value: 'tedarikci', label: 'Tedarikçi Sözleşmesi', color: 'bg-indigo-50 text-indigo-700' },
  { value: 'musteri', label: 'Müşteri Sözleşmesi', color: 'bg-blue-50 text-blue-700' },
  { value: 'gizlilik', label: 'Gizlilik Sözleşmesi', color: 'bg-amber-50 text-amber-700' },
  { value: 'kvkk', label: 'KVKK', color: 'bg-purple-50 text-purple-700' },
];

const CONTRACT_PLACEHOLDERS = [
  { key: '{{sozlesme_no}}', desc: 'Sözleşme numarası' },
  { key: '{{sozlesme_tarihi}}', desc: 'Sözleşme tarihi' },
  { key: '{{baslangic_tarihi}}', desc: 'İşe başlangıç tarihi' },
  { key: '{{teslim_tarihi}}', desc: 'Teslim tarihi' },
  { key: '{{dosya_no}}', desc: 'Hasar dosya numarası' },
  { key: '{{sigorta_sirketi}}', desc: 'Sigorta şirketi adı' },
  { key: '{{hasar_adresi}}', desc: 'Hasar adresi' },
  { key: '{{sigorta_musteri_ad}}', desc: 'Sigortalı adı' },
  { key: '{{tedarikci_ad}}', desc: 'Tedarikçi adı' },
  { key: '{{tedarikci_vergi_no}}', desc: 'Vergi / TC No' },
  { key: '{{tedarikci_adres}}', desc: 'Tedarikçi adresi' },
  { key: '{{toplam_tutar}}', desc: 'Toplam tutar' },
];

interface ContractTemplate {
  id: string;
  name: string;
  type: 'tedarikci' | 'musteri' | 'gizlilik' | 'kvkk';
  description?: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  type: 'tedarikci' | 'musteri' | 'gizlilik' | 'kvkk';
  description: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm = (): FormState => ({
  name: '',
  type: 'tedarikci',
  description: '',
  content: '',
  isActive: true,
  sortOrder: 0,
});

function typeBadge(type: string) {
  return CONTRACT_TYPES.find((t) => t.value === type) ?? { label: type, color: 'bg-slate-100 text-slate-600' };
}

export default function SozlesmeSablonlariPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/contract-templates`, { headers: authHeader() });
      setTemplates(res.data.data ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalError('');
    setPreviewMode(false);
    setShowModal(true);
  };

  const openEdit = (t: ContractTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      type: t.type,
      description: t.description ?? '',
      content: t.content,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
    });
    setModalError('');
    setPreviewMode(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setModalError('Şablon adı zorunludur.'); return; }
    if (!form.type) { setModalError('Sözleşme türü zorunludur.'); return; }
    if (!form.content.trim()) { setModalError('Şablon içeriği zorunludur.'); return; }
    const dup = templates.find(
      (t) => t.name.trim().toLowerCase() === form.name.trim().toLowerCase()
        && t.type === form.type
        && (!editing || t.id !== editing.id)
    );
    if (dup) { setModalError('Bu ad ve türde bir şablon zaten mevcut.'); return; }
    setSaving(true);
    setModalError('');
    try {
      if (editing) {
        await axios.put(`${API}/system-settings/contract-templates/${editing.id}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/system-settings/contract-templates`, form, { headers: authHeader() });
      }
      setShowModal(false);
      loadTemplates();
    } catch (err: any) {
      setModalError(err?.response?.data?.message ?? 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (t: ContractTemplate) => {
    try {
      await axios.put(`${API}/system-settings/contract-templates/${t.id}`, { isActive: !t.isActive }, { headers: authHeader() });
      loadTemplates();
    } catch {
      alert('Durum güncellenemedi.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/system-settings/contract-templates/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      loadTemplates();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Silinemedi.');
    } finally {
      setDeleting(false);
    }
  };

  const insertPlaceholder = (key: string) => {
    setForm((f) => ({ ...f, content: f.content + key }));
  };

  return (
    <SettingsTableColumnsProvider columns={TABLE_COLUMNS}>
      {(tableColumns) => (
    <SettingsPageLayout
      title="Sözleşme Şablonları"
      description="Tedarikçi, müşteri, gizlilik ve KVKK sözleşme şablonlarını yönetin."
      addButtonText="+ Yeni Şablon"
      onAdd={openCreate}
      headerExtra={<SettingsTableColumnPicker tableColumns={tableColumns} />}
    >

      <SettingsTable
        loading={loading}
        empty={templates.length === 0}
        emptyText="Henüz sözleşme şablonu tanımlanmamış."
      >
        <SettingsTableHead>
          <SettingsTableTh colId="name">Şablon Adı</SettingsTableTh>
          <SettingsTableTh colId="type">Tür</SettingsTableTh>
          <SettingsTableTh colId="description">Açıklama</SettingsTableTh>
          <SettingsTableTh colId="status">Durum</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {templates.map((t) => {
            const badge = typeBadge(t.type);
            return (
              <SettingsTableRow key={t.id}>
                <SettingsTableTd colId="name">
                  <p className="font-medium text-slate-800">{t.name}</p>
                </SettingsTableTd>
                <SettingsTableTd colId="type">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                </SettingsTableTd>
                <SettingsTableTd colId="description">
                  <p className="text-xs text-slate-500 truncate max-w-xs">{t.description || '—'}</p>
                </SettingsTableTd>
                <SettingsTableTd colId="status">
                  <button type="button" onClick={() => handleToggleActive(t)}>
                    <StatusBadge active={t.isActive} />
                  </button>
                </SettingsTableTd>
                <SettingsTableActions>
                  <EditButton onClick={() => openEdit(t)} />
                  <DeleteButton onClick={() => setDeleteTarget(t)} />
                </SettingsTableActions>
              </SettingsTableRow>
            );
          })}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Şablon Düzenle: ${editing.name}` : 'Yeni Sözleşme Şablonu'}
        onSave={handleSave}
        saving={saving}
        error={modalError}
        maxWidth="xl"
      >
        {/* Önizleme toggle */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              previewMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {previewMode ? 'Düzenle' : 'Önizle'}
          </button>
        </div>

        {previewMode ? (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">İçerik Önizlemesi</p>
            <div className="border border-slate-200 rounded-lg p-4 min-h-48 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.content || '<p class="text-slate-300 italic">İçerik yok</p>') }} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Şablon Adı <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="ör. Standart Tedarikçi Sözleşmesi"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Sözleşme Türü <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                <select
                  className={`${inputCls} bg-white`}
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FormState['type'] }))}
                >
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Açıklama</label>
              <input
                type="text"
                className={inputCls}
                placeholder="Opsiyonel"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>Şablon İçeriği (HTML) <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPlaceholders((v) => !v)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    {showPlaceholders ? 'Değişkenleri Gizle' : 'Değişkenleri Göster'}
                  </button>
                  <span className="text-xs text-slate-400">{form.content.length} karakter</span>
                </div>
              </div>

              {showPlaceholders && (
                <div className="mb-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-800 mb-2">Kullanılabilir Değişkenler:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CONTRACT_PLACEHOLDERS.map((ph) => (
                      <button
                        key={ph.key}
                        type="button"
                        onClick={() => insertPlaceholder(ph.key)}
                        title={ph.desc}
                        className="px-2 py-1 bg-white border border-amber-200 rounded text-xs font-mono text-amber-800 hover:bg-amber-100 transition-colors"
                      >
                        {ph.key}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                rows={10}
                className={`${inputCls} font-mono text-xs leading-relaxed resize-y`}
                placeholder={'<h2>SÖZLEŞME BAŞLIĞI</h2>\n<p>Bu sözleşme, <strong>{{tedarikci_ad}}</strong> ile…</p>'}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Sıra</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end pb-1">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className="flex items-center gap-2"
                >
                  <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </span>
                  <span className="text-sm text-slate-700">{form.isActive ? 'Aktif' : 'Pasif'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        itemName={deleteTarget?.name}
        description={`"${deleteTarget?.name}" şablonunu silmek istediğinize emin misiniz?`}
      />
    </SettingsPageLayout>
      )}
    </SettingsTableColumnsProvider>
  );
}
