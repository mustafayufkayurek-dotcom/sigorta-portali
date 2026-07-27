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
  SettingsRowIndexTh,
  SettingsRowIndexTd,
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import { normalizeFormFreeText } from '@/utils/text-helpers';


const TEMPLATE_TYPES = [
  { value: 'tespit', label: 'Tespit Raporu', color: 'bg-blue-50 text-blue-700' },
  { value: 'maliyet', label: 'Maliyet Raporu', color: 'bg-green-50 text-green-700' },
  { value: 'kesif', label: 'Keşif Raporu', color: 'bg-amber-50 text-amber-700' },
  { value: 'hasar', label: 'Hasar Raporu', color: 'bg-red-50 text-red-700' },
];

const REPORT_PLACEHOLDERS = [
  { key: '{dosyaNo}', desc: 'Dosya numarası' },
  { key: '{musteriAdi}', desc: 'Sigortalı adı' },
  { key: '{hasarAdresi}', desc: 'Hasar adresi' },
  { key: '{sigortaSirketi}', desc: 'Sigorta şirketi' },
  { key: '{eksperAdi}', desc: 'Eksper adı' },
  { key: '{tarih}', desc: 'Tarih' },
  { key: '{hasarTarihi}', desc: 'Hasar tarihi' },
  { key: '{tespitBilgileri}', desc: 'Tespit bilgileri' },
  { key: '{isKalemleri}', desc: 'İş kalemleri tablosu' },
  { key: '{toplamTutar}', desc: 'Toplam tutar' },
];

interface DocumentTemplate {
  id: string;
  name: string;
  type: 'tespit' | 'maliyet' | 'kesif' | 'hasar';
  description?: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  type: 'tespit' | 'maliyet' | 'kesif' | 'hasar';
  description: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm = (): FormState => ({
  name: '',
  type: 'tespit',
  description: '',
  content: '',
  isActive: true,
  sortOrder: 0,
});

function typeBadge(type: string) {
  const found = TEMPLATE_TYPES.find((t) => t.value === type);
  return found ?? { label: type, color: 'bg-slate-100 text-slate-600' };
}

export default function RaporSablonlariPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/document-report-templates`, { headers: authHeader() });
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

  const openEdit = (t: DocumentTemplate) => {
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
    const name = normalizeFormFreeText(form.name);
    const description = form.description.trim() ? normalizeFormFreeText(form.description) : '';
    if (!name) { setModalError('Şablon adı zorunludur.'); return; }
    if (!form.type) { setModalError('Şablon türü zorunludur.'); return; }
    if (!form.content.trim()) { setModalError('Şablon içeriği zorunludur.'); return; }
    const dup = templates.find(
      (t) => t.name.trim().toLowerCase() === name.toLowerCase()
        && t.type === form.type
        && (!editing || t.id !== editing.id)
    );
    if (dup) { setModalError('Bu ad ve türde bir şablon zaten mevcut.'); return; }
    const sortOrder = editing ? editing.sortOrder : templates.length + 1;
    const payload = { ...form, name, description, sortOrder };
    setSaving(true);
    setModalError('');
    try {
      if (editing) {
        await axios.put(`${API}/system-settings/document-report-templates/${editing.id}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/system-settings/document-report-templates`, payload, { headers: authHeader() });
      }
      setShowModal(false);
      loadTemplates();
    } catch (err: any) {
      setModalError(err?.response?.data?.message ?? 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (t: DocumentTemplate) => {
    try {
      await axios.put(`${API}/system-settings/document-report-templates/${t.id}`, { isActive: !t.isActive }, { headers: authHeader() });
      loadTemplates();
    } catch {
      alert('Durum güncellenemedi.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/system-settings/document-report-templates/${deleteTarget.id}`, { headers: authHeader() });
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
    <SettingsPageLayout
      title="Rapor Şablonları"
      description="Tespit, Maliyet, Keşif ve Hasar raporları için belge şablonlarını yönetin."
      addButtonText="+ Yeni Şablon"
      onAdd={openCreate}
    >

      <SettingsTable
        loading={loading}
        empty={templates.length === 0}
        emptyText="Henüz rapor şablonu tanımlanmamış."
      >
        <SettingsTableHead>
          <SettingsRowIndexTh />
          <SettingsTableTh>Şablon Adı</SettingsTableTh>
          <SettingsTableTh>Tür</SettingsTableTh>
          <SettingsTableTh>Açıklama</SettingsTableTh>
          <SettingsTableTh>Durum</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {templates.map((t, index) => {
            const badge = typeBadge(t.type);
            return (
              <SettingsTableRow key={t.id}>
                <SettingsRowIndexTd index={index} />
                <SettingsTableTd>
                  <p className="font-medium text-slate-800">{t.name}</p>
                </SettingsTableTd>
                <SettingsTableTd>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                </SettingsTableTd>
                <SettingsTableTd>
                  <p className="text-xs text-slate-500 truncate max-w-xs">{t.description || '—'}</p>
                </SettingsTableTd>
                <SettingsTableTd>
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
        title={editing ? `Şablon Düzenle: ${editing.name}` : 'Yeni Rapor Şablonu'}
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
            <p className="text-xs font-medium text-slate-500 mb-1.5 tracking-wide">İçerik Önizlemesi</p>
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
                  placeholder="ör. Standart Tespit Raporu"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onBlur={(e) => {
                    const v = normalizeFormFreeText(e.target.value);
                    if (v !== e.target.value.trim()) setForm((f) => ({ ...f, name: v }));
                  }}
                />
              </div>
              <div>
                <label className={labelCls}>Şablon Türü <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                <select
                  className={`${inputCls} bg-white`}
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FormState['type'] }))}
                >
                  {TEMPLATE_TYPES.map((t) => (
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
                onBlur={(e) => {
                  const v = normalizeFormFreeText(e.target.value);
                  if (v !== e.target.value.trim()) setForm((f) => ({ ...f, description: v }));
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>Şablon İçeriği (HTML) <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                <span className="text-xs text-slate-400">{form.content.length} karakter</span>
              </div>
              <textarea
                rows={10}
                className={`${inputCls} font-mono text-xs leading-relaxed resize-y`}
                placeholder={'<h2>TESPİT RAPORU</h2>\n<p><strong>Dosya No:</strong> {dosyaNo}</p>'}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Hızlı Değişken Ekle:</p>
              <div className="flex flex-wrap gap-1.5">
                {REPORT_PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph.key}
                    type="button"
                    onClick={() => insertPlaceholder(ph.key)}
                    title={ph.desc}
                    className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    {ph.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end pb-1">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className="flex items-center gap-2"
                >
                  <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-brand-600' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </span>
                  <span className="text-sm text-slate-700">{form.isActive ? 'Aktif' : 'Pasif'}</span>
                </button>
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
  );
}
