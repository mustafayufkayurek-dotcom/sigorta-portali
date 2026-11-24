'use client';

/**
 * Ofis / sabit hizmet türleri — Tedarikçi kartı Ofis seçiminde aynı liste.
 * Satırdan Yeni Tür de buraya yazar.
 */
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, formatSettingsApiError, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
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
import { resolveOfisVendorTypeList } from '@/utils/vendor-type-list';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { useToast } from '@/contexts/ToastContext';

function isDigerType(name: string) {
  const n = name.toLocaleLowerCase('tr');
  return n === 'diğer' || n === 'diger';
}

export default function OfisHizmetTurleriPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [modalError, setModalError] = useState('');
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const persist = useCallback(async (next: string[]) => {
    const cleaned = resolveOfisVendorTypeList(next);
    await axios.put(
      `${API}/system-settings/office-vendor-types`,
      { types: cleaned },
      { headers: authHeader() },
    );
    setRows(cleaned);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/system-settings/office-vendor-types`, {
        headers: authHeader(),
      });
      setRows(resolveOfisVendorTypeList(res.data?.data));
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
      setRows(resolveOfisVendorTypeList([]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    const name = toTitleCaseTR(newName.trim());
    if (!name) {
      setModalError('Tür adı zorunludur');
      return;
    }
    if (rows.some((r) => r.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) {
      setModalError('Bu tür zaten listede');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const withoutOther = rows.filter((r) => !isDigerType(r));
      await persist([...withoutOther, name, 'Diğer']);
      setShowModal(false);
      setNewName('');
      showToast('success', `"${name}" eklendi`);
    } catch (e: unknown) {
      setModalError(formatSettingsApiError(e, 'Kayıt yapılamadı'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteIdx === null) return;
    const target = rows[deleteIdx];
    if (!target || isDigerType(target)) {
      setDeleteIdx(null);
      return;
    }
    setDeleting(true);
    try {
      await persist(rows.filter((_, i) => i !== deleteIdx));
      setDeleteIdx(null);
      showToast('success', `"${target}" kaldırıldı`);
    } catch (e: unknown) {
      showToast('error', formatSettingsApiError(e, 'Silinemedi'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPageLayout
      title="Ofis Hizmet Türleri"
      description="Ofis / sabit hizmet tedarikçi kartında Hizmet Türü listesi. Tedarikçi formundan Yeni Tür ile de eklenir."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      addButtonText="Yeni Tür"
      onAdd={() => {
        setNewName('');
        setModalError('');
        setShowModal(true);
      }}
    >
      {error ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <SettingsTable loading={loading} empty={!loading && rows.length === 0} emptyText="Henüz tür yok.">
        <SettingsTableHead>
          <SettingsRowIndexTh />
          <SettingsTableTh>Tür Adı</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {rows.map((name, idx) => (
            <SettingsTableRow key={`${name}-${idx}`}>
              <SettingsRowIndexTd index={idx} />
              <SettingsTableTd>{name}</SettingsTableTd>
              {!isDigerType(name) ? (
                <SettingsTableActions>
                  <DeleteButton onClick={() => setDeleteIdx(idx)} />
                </SettingsTableActions>
              ) : (
                <SettingsTableTd />
              )}
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Yeni Ofis Hizmet Türü"
        onSave={() => { void handleAdd(); }}
        saving={saving}
        error={modalError || undefined}
      >
        <div>
          <label className={labelCls}>Tür Adı *</label>
          <input
            className={inputCls}
            value={newName}
            placeholder="Örn. Doğalgaz"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteIdx !== null}
        onClose={() => setDeleteIdx(null)}
        onConfirm={() => { void handleDelete(); }}
        deleting={deleting}
        itemName={deleteIdx !== null ? rows[deleteIdx] : undefined}
        title="Türü Kaldır"
      />
    </SettingsPageLayout>
  );
}
