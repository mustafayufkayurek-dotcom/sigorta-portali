'use client';

import { useEffect, useState } from 'react';
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
  { id: 'trigger', label: 'Tetikleyici Olay', defaultWidth: 160, minWidth: 120 },
  { id: 'subject', label: 'Konu', defaultWidth: 220, minWidth: 140 },
  { id: 'status', label: 'Durum', defaultWidth: 100, minWidth: 80 },
];

const TRIGGER_EVENTS = [
  { value: 'file_opened', label: 'Dosya Açıldı' },
  { value: 'file_assigned', label: 'Dosya Atandı' },
  { value: 'field_visit_planned', label: 'Tespit Planlama' },
  { value: 'repair_completed', label: 'Onarım Tamamlandı' },
  { value: 'report_sent_for_approval', label: 'Rapor Onaya Gönderildi' },
  { value: 'file_closed', label: 'Dosya Kapatıldı' },
  { value: 'file_cancelled', label: 'Dosya İptal Edildi' },
  { value: 'revision_requested', label: 'Revizyon Talep Edildi' },
  { value: 'revision_approved', label: 'Revizyon Onaylandı' },
  { value: 'revision_rejected', label: 'Revizyon Reddedildi' },
  { value: 'approval_requested', label: 'Rapor Onay Talep' },
  { value: 'approval_given', label: 'Onay Verildi' },
  { value: 'progress_payment_approval', label: 'Hakediş Onay' },
  { value: 'payment_approval', label: 'Ödeme Onay' },
  { value: 'appointment_created', label: 'Randevu Oluşturuldu' },
  { value: 'appointment_reminder', label: 'Randevu Hatırlatması' },
  { value: 'invoice_created', label: 'Fatura Oluşturuldu' },
  { value: 'payment_received', label: 'Tahsilat Yapıldı' },
  { value: 'custom', label: 'Özel / Manuel' },
];

const PLACEHOLDERS = [
  { key: '{musteriAdi}', desc: 'Sigortalının adı soyadı' },
  { key: '{dosyaNo}', desc: 'Hasar dosya numarası' },
  { key: '{tarih}', desc: 'İşlem tarihi' },
  { key: '{sirketAdi}', desc: 'Şirket adı' },
  { key: '{sirketTelefon}', desc: 'Şirket telefon numarası' },
  { key: '{sirketEmail}', desc: 'Şirket e-posta adresi' },
  { key: '{eksperAdi}', desc: 'Atanan eksper adı' },
  { key: '{panelLinki}', desc: 'Müşteri panel linki' },
];

interface EmailTemplate {
  id: string;
  name: string;
  triggerEvent: string;
  subject: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  triggerEvent: string;
  subject: string;
  body: string;
  isActive: boolean;
}

const emptyForm = (): FormState => ({
  name: '',
  triggerEvent: 'file_opened',
  subject: '',
  body: '',
  isActive: true,
});

export default function EmailBildirimleriPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/notifications/email/templates`, { headers: authHeader() });
      setTemplates(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalError('');
    setPreviewMode(false);
    setShowModal(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setForm({ name: t.name, triggerEvent: t.triggerEvent, subject: t.subject, body: t.body, isActive: t.isActive });
    setModalError('');
    setPreviewMode(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      setModalError('Şablon adı, konu ve içerik zorunludur.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      if (!editing) {
        const res = await axios.post(`${API}/notifications/email/templates`, form, { headers: authHeader() });
        const created: EmailTemplate = res.data?.data ?? res.data;
        setTemplates((prev) => [created, ...prev]);
      } else {
        const res = await axios.patch(`${API}/notifications/email/templates/${editing.id}`, form, { headers: authHeader() });
        const updated: EmailTemplate = res.data?.data ?? res.data;
        setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      }
      setShowModal(false);
    } catch (err: any) {
      setModalError(err?.response?.data?.message ?? 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/notifications/email/templates/${deleteTarget.id}`, { headers: authHeader() });
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const insertPlaceholder = (key: string) => {
    setForm((f) => ({ ...f, body: f.body + key }));
  };

  const triggerLabel = (val: string) => TRIGGER_EVENTS.find((e) => e.value === val)?.label ?? val;

  return (
    <SettingsTableColumnsProvider columns={TABLE_COLUMNS}>
      {(tableColumns) => (
    <SettingsPageLayout
      title="E-posta Bildirimleri"
      description="Sistem olaylarına bağlı e-posta şablonlarını yönetin."
      addButtonText="+ Yeni Şablon"
      onAdd={openCreate}
      headerExtra={<SettingsTableColumnPicker tableColumns={tableColumns} />}
    >

      <SettingsTable loading={loading} empty={templates.length === 0} emptyText="Henüz e-posta şablonu eklenmemiş.">
        <SettingsTableHead>
          <SettingsTableTh colId="name">Şablon Adı</SettingsTableTh>
          <SettingsTableTh colId="trigger">Tetikleyici Olay</SettingsTableTh>
          <SettingsTableTh colId="subject">Konu</SettingsTableTh>
          <SettingsTableTh colId="status">Durum</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {templates.map((t) => (
            <SettingsTableRow key={t.id}>
              <SettingsTableTd colId="name">
                <p className="font-medium text-slate-800">{t.name}</p>
              </SettingsTableTd>
              <SettingsTableTd colId="trigger">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {triggerLabel(t.triggerEvent)}
                </span>
              </SettingsTableTd>
              <SettingsTableTd colId="subject">
                <p className="text-xs text-slate-500 truncate max-w-xs">{t.subject}</p>
              </SettingsTableTd>
              <SettingsTableTd colId="status">
                <StatusBadge active={t.isActive} />
              </SettingsTableTd>
              <SettingsTableActions>
                <EditButton onClick={() => openEdit(t)} />
                <DeleteButton onClick={() => setDeleteTarget(t)} />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Şablonu Düzenle: ${editing.name}` : 'Yeni E-posta Şablonu'}
        onSave={handleSave}
        saving={saving}
        error={modalError}
        maxWidth="xl"
      >
        {/* Önizle toggle */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              previewMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            {previewMode ? 'Düzenle' : 'Önizle'}
          </button>
        </div>

        {previewMode ? (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5 tracking-wide">HTML Önizleme</p>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <p className="text-xs text-slate-500"><span className="font-medium">Konu:</span> {form.subject || <span className="italic text-slate-300">boş</span>}</p>
              </div>
              <div className="p-4 min-h-48 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.body || '<p class="text-slate-300 italic">İçerik yok</p>') }} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Şablon Adı *</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="ör: Dosya Açılış Bildirimi"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Tetikleyici Olay</label>
                <select className={`${inputCls} bg-white`} value={form.triggerEvent} onChange={(e) => setForm((f) => ({ ...f, triggerEvent: e.target.value }))}>
                  {TRIGGER_EVENTS.map((ev) => (
                    <option key={ev.value} value={ev.value}>{ev.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>E-posta Konusu *</label>
              <input
                type="text"
                className={inputCls}
                placeholder="ör: Hasar dosyanız ({dosyaNo}) hakkında bilgi"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>HTML İçerik *</label>
                <span className="text-xs text-slate-400">{form.body.length} karakter</span>
              </div>
              <textarea
                rows={10}
                className={`${inputCls} font-mono text-xs leading-relaxed resize-y`}
                placeholder={'<p>Sayın {musteriAdi},</p>\n<p>Hasar dosyanız ({dosyaNo}) oluşturulmuştur.</p>'}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Hızlı Değişken Ekle:</p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((ph) => (
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

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-slate-700">{form.isActive ? 'Aktif — bu şablon gönderimde kullanılır' : 'Pasif — bu şablon gönderimde kullanılmaz'}</span>
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
      />
    </SettingsPageLayout>
      )}
    </SettingsTableColumnsProvider>
  );
}
