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
  StatusBadge,
  SettingsFieldLabel,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { useToast } from '@/contexts/ToastContext';
import { CONSULTANCY_SERVICE_FAMILY } from '@sigorta/shared';

type ConsultancyTypeRow = {
  id: string;
  name: string;
  code?: string | null;
  isActive: boolean;
  isSystem?: boolean;
};

const emptyForm = () => ({ name: '' });

export default function DanismanlikHizmetTurleriPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ConsultancyTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ConsultancyTypeRow | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [modalError, setModalError] = useState('');

  const [deleteRow, setDeleteRow] = useState<ConsultancyTypeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/service-types`, {
        headers: authHeader(),
        params: { family: CONSULTANCY_SERVICE_FAMILY },
      });
      setRows((res.data?.data ?? []) as ConsultancyTypeRow[]);
    } catch (e: unknown) {
      setError(formatSettingsApiError(e, 'Hizmet türleri okunamadı'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (row: ConsultancyTypeRow) => {
    setEditing(row);
    setForm({ name: row.name });
    setModalError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const name = toTitleCaseTR(form.name.trim());
    if (!name) {
      setModalError('Hizmet türü adı zorunludur.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      if (editing) {
        await axios.put(`${API}/service-types/${editing.id}`, { name }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/service-types`, { name }, { headers: authHeader() });
      }
      setShowModal(false);
      await load();
    } catch (e: unknown) {
      setModalError(formatSettingsApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/service-types/${deleteRow.id}`, { headers: authHeader() });
      setDeleteRow(null);
      await load();
    } catch (e: unknown) {
      showToast('error', formatSettingsApiError(e, 'Silinemedi'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPageLayout
      title="Danışmanlık Hizmet Türleri"
      description="Danışmanlık dosyasında seçilen hizmetler. Hasar Tespit durur; yenisi gerektiğinde buradan eklenir."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700"
        >
          Hizmet Türü Ekle
        </button>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <SettingsTable loading={loading} empty={rows.length === 0} emptyText="Henüz danışmanlık hizmet türü yok.">
          <SettingsTableHead>
            <SettingsRowIndexTh />
            <SettingsTableTh>Hizmet Türü</SettingsTableTh>
            <SettingsTableTh>Durum</SettingsTableTh>
            <SettingsTableTh />
          </SettingsTableHead>
          <SettingsTableBody>
            {rows.map((row, index) => (
              <SettingsTableRow key={row.id}>
                <SettingsRowIndexTd index={index} />
                <SettingsTableTd>
                  <span className="font-medium text-slate-900">{row.name}</span>
                  {row.isSystem ? (
                    <span className="ml-2 text-[11px] text-slate-400">Sabit</span>
                  ) : null}
                </SettingsTableTd>
                <SettingsTableTd>
                  <StatusBadge active={row.isActive} />
                </SettingsTableTd>
                <SettingsTableActions>
                  {row.isSystem ? null : (
                    <>
                      <EditButton onClick={() => openEdit(row)} />
                      <DeleteButton onClick={() => setDeleteRow(row)} />
                    </>
                  )}
                </SettingsTableActions>
              </SettingsTableRow>
            ))}
          </SettingsTableBody>
        </SettingsTable>
      </div>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Hizmet Türünü Düzenle' : 'Yeni Hizmet Türü'}
        onSave={handleSave}
        saving={saving}
        error={modalError}
      >
        <div>
          <SettingsFieldLabel help="Yeni dosyada Danışmanlık seçilince bu ad görünür.">
            Hizmet Türü Adı
          </SettingsFieldLabel>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            onBlur={() => {
              const v = toTitleCaseTR(form.name.trim());
              if (v !== form.name) setForm({ name: v });
            }}
            placeholder="Örn. sovtaj"
            disabled={editing?.isSystem}
          />
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={Boolean(deleteRow)}
        onClose={() => setDeleteRow(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        itemName={deleteRow?.name}
        title="Hizmet Türünü Sil"
      />
    </SettingsPageLayout>
  );
}
