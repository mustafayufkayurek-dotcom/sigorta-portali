'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, formatSettingsApiError, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  EditButton,
  DeleteButton,
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
import {
  DEFAULT_CUSTOMER_SUB_TYPES,
  subTypeActiveClass,
  type CustomerSubTypeDef,
} from '@/utils/customer-form-helpers';
import { normalizeFormFreeText, sanitizeCode } from '@/utils/text-helpers';
import { useToast } from '@/contexts/ToastContext';

const FOR_TYPE_OPTIONS: { value: CustomerSubTypeDef['forType']; label: string }[] = [
  { value: 'corporate', label: 'Kurumsal' },
  { value: 'individual', label: 'Bireysel' },
  { value: 'both', label: 'Her İkisi' },
];

const COLOR_OPTIONS: { value: CustomerSubTypeDef['color']; label: string }[] = [
  { value: 'blue', label: 'Mavi' },
  { value: 'gray', label: 'Gri' },
  { value: 'orange', label: 'Turuncu' },
  { value: 'purple', label: 'Mor' },
  { value: 'green', label: 'Yeşil' },
];

function forTypeLabel(forType: CustomerSubTypeDef['forType']) {
  return FOR_TYPE_OPTIONS.find((o) => o.value === forType)?.label ?? forType;
}

function codeFromLabel(label: string) {
  return sanitizeCode(label).toLowerCase();
}

const emptyForm = (): Omit<CustomerSubTypeDef, 'value'> & { value: string } => ({
  value: '',
  label: '',
  forType: 'corporate',
  color: 'blue',
});

export default function MusteriTipleriPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<CustomerSubTypeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [modalError, setModalError] = useState('');

  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const persist = useCallback(async (next: CustomerSubTypeDef[]) => {
    await axios.put(`${API}/system-settings/customer-sub-types`, { values: next }, { headers: authHeader() });
    setRows(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/system-settings/customer-sub-types`, { headers: authHeader() });
      const list: CustomerSubTypeDef[] = res.data?.data ?? [];
      setRows(Array.isArray(list) && list.length ? list : DEFAULT_CUSTOMER_SUB_TYPES);
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
      setRows(DEFAULT_CUSTOMER_SUB_TYPES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingIdx(null);
    setForm(emptyForm());
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (idx: number) => {
    const row = rows[idx];
    setEditingIdx(idx);
    setForm({ ...row });
    setModalError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const label = normalizeFormFreeText(form.label);
    if (!label) {
      setModalError('Tip adı zorunludur');
      return;
    }
    const value = editingIdx !== null ? rows[editingIdx].value : codeFromLabel(label);
    if (!value) {
      setModalError('Geçerli bir kod üretilemedi');
      return;
    }
    if (editingIdx === null && rows.some((r) => r.value === value)) {
      setModalError('Bu kod zaten tanımlı');
      return;
    }

    const nextRow: CustomerSubTypeDef = {
      value,
      label,
      forType: form.forType,
      color: form.color,
    };

    setSaving(true);
    setModalError('');
    try {
      const next = editingIdx !== null
        ? rows.map((r, i) => (i === editingIdx ? nextRow : r))
        : [...rows, nextRow];
      await persist(next);
      setShowModal(false);
    } catch (e: unknown) {
      setModalError(formatSettingsApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteIdx === null) return;
    setDeleting(true);
    try {
      const next = rows.filter((_, i) => i !== deleteIdx);
      await persist(next);
      setDeleteIdx(null);
    } catch (e: unknown) {
      showToast('error', formatSettingsApiError(e, 'Silinemedi'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPageLayout
      title="Müşteri Tipleri"
      description="Müşteri kartında önce seçilen alt tip sözlüğü. Burada tanım yapılır; firma adı ve cari bilgileri Müşteriler ekranında girilir."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700"
        >
          Tip Ekle
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Örnek: <strong>Asistans Firması</strong> tipini seçtikten sonra Müşteriler&apos;de <strong>X Asistan Firması</strong> cari kaydı açılır.
          Bu ekranda yalnızca tip tanımı vardır.
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <SettingsTable loading={loading} empty={rows.length === 0} emptyText="Henüz müşteri tipi tanımlanmamış.">
          <SettingsTableHead>
            <SettingsRowIndexTh />
            <SettingsTableTh>Tip Adı</SettingsTableTh>
            <SettingsTableTh>Kod</SettingsTableTh>
            <SettingsTableTh>Cari Tipi</SettingsTableTh>
            <SettingsTableTh className="text-center">Rozet</SettingsTableTh>
            <SettingsTableTh />
          </SettingsTableHead>
          <SettingsTableBody>
            {rows.map((row, index) => (
              <SettingsTableRow key={row.value}>
                <SettingsRowIndexTd index={index} />
                <SettingsTableTd>
                  <span className="font-medium text-slate-900">{row.label}</span>
                </SettingsTableTd>
                <SettingsTableTd className="font-mono text-xs text-slate-500">{row.value}</SettingsTableTd>
                <SettingsTableTd className="text-slate-600">{forTypeLabel(row.forType)}</SettingsTableTd>
                <SettingsTableTd className="text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium border ${subTypeActiveClass(row.color).replace('text-white', 'text-white border-transparent')}`}>
                    {row.label}
                  </span>
                </SettingsTableTd>
                <SettingsTableActions>
                  <EditButton onClick={() => openEdit(index)} />
                  <DeleteButton onClick={() => setDeleteIdx(index)} />
                </SettingsTableActions>
              </SettingsTableRow>
            ))}
          </SettingsTableBody>
        </SettingsTable>
      </div>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingIdx !== null ? 'Müşteri Tipini Düzenle' : 'Yeni Müşteri Tipi'}
        onSave={handleSave}
        saving={saving}
        error={modalError}
      >
        <div>
          <label className={labelCls}>Tip Adı *</label>
          <input
            className={inputCls}
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            onBlur={() => {
              const v = normalizeFormFreeText(form.label);
              if (v !== form.label) setForm((p) => ({ ...p, label: v }));
            }}
            placeholder="Örn: Broker Firması"
          />
        </div>
        {editingIdx === null && form.label.trim() && (
          <p className="text-xs text-slate-400">Kod: {codeFromLabel(form.label)}</p>
        )}
        {editingIdx !== null && (
          <p className="text-xs text-slate-400">Kod: {form.value} (değiştirilemez)</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Cari Tipi</label>
            <select
              className={inputCls}
              value={form.forType}
              onChange={(e) => setForm((p) => ({ ...p, forType: e.target.value as CustomerSubTypeDef['forType'] }))}
            >
              {FOR_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Rozet Rengi</label>
            <select
              className={inputCls}
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value as CustomerSubTypeDef['color'] }))}
            >
              {COLOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteIdx !== null}
        onClose={() => setDeleteIdx(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        itemName={deleteIdx !== null ? rows[deleteIdx]?.label : undefined}
      />
    </SettingsPageLayout>
  );
}
