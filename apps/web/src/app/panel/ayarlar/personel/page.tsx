'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
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
  SettingsRowIndexTh,
  SettingsRowIndexTd,
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { normalizeFormFreeText, toTitleCaseTR } from '@/utils/text-helpers';

type CatalogItem = {
  code: string;
  label: string;
  active: boolean;
};

const LEAVE_DEFAULTS: CatalogItem[] = [
  { code: 'annual', label: 'Yıllık İzin', active: true },
  { code: 'sick', label: 'Hastalık İzni', active: true },
  { code: 'unpaid', label: 'Ücretsiz İzin', active: true },
  { code: 'other', label: 'Diğer', active: true },
];

const ASSET_DEFAULTS: CatalogItem[] = [
  { code: 'phone', label: 'Cep Telefonu', active: true },
  { code: 'laptop', label: 'Dizüstü', active: true },
  { code: 'tablet', label: 'Tablet', active: true },
  { code: 'other', label: 'Diğer', active: true },
];

function slugifyCode(label: string, fallback: string) {
  const base = label
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return base || fallback;
}

function CatalogSection({
  title,
  hint,
  endpoint,
  defaults,
  addLabel,
  itemLabel,
}: {
  title: string;
  hint: string;
  endpoint: string;
  defaults: CatalogItem[];
  addLabel: string;
  itemLabel: string;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formCode, setFormCode] = useState('');
  const [modalError, setModalError] = useState('');
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/${endpoint}`, {
        headers: authHeader(),
      });
      const data = (res.data?.data ?? []) as CatalogItem[];
      setItems(data.length > 0 ? data : defaults);
      setError('');
    } catch (e) {
      console.error(e);
      setItems(defaults);
      setError(`${title} yüklenemedi; varsayılan liste gösteriliyor.`);
    } finally {
      setLoading(false);
    }
  }, [defaults, endpoint, title]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const save = async (updated: CatalogItem[]) => {
    setSaving(true);
    setError('');
    try {
      await axios.put(
        `${API}/system-settings/${endpoint}`,
        { values: updated },
        { headers: authHeader() },
      );
      setItems(updated);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setError(msg ?? 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditingIdx(null);
    setFormLabel('');
    setFormCode('');
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (idx: number) => {
    setEditingIdx(idx);
    setFormLabel(items[idx].label);
    setFormCode(items[idx].code);
    setModalError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const label = toTitleCaseTR(normalizeFormFreeText(formLabel));
    if (!label) {
      setModalError(`${itemLabel} Adı Zorunludur`);
      return;
    }
    const code =
      formCode.trim().toLowerCase().replace(/\s+/g, '_') ||
      slugifyCode(label, `item_${Date.now()}`);

    if (editingIdx === null) {
      if (items.some((t) => t.code === code || t.label === label)) {
        setModalError(`Bu ${itemLabel} Zaten Mevcut`);
        return;
      }
      await save([...items, { code, label, active: true }]);
    } else {
      if (
        items.some(
          (t, i) => i !== editingIdx && (t.code === code || t.label === label),
        )
      ) {
        setModalError(`Bu ${itemLabel} Zaten Mevcut`);
        return;
      }
      const updated = items.map((t, i) =>
        i === editingIdx ? { ...t, code, label } : t,
      );
      await save(updated);
    }
    setShowModal(false);
  };

  const handleDelete = async (idx: number) => {
    await save(items.filter((_, i) => i !== idx));
    setDeleteIdx(null);
  };

  const handleToggleActive = async (idx: number) => {
    const updated = items.map((t, i) =>
      i === idx ? { ...t, active: !t.active } : t,
    );
    await save(updated);
  };

  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const updated = [...items];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    await save(updated);
  };

  const handleMoveDown = async (idx: number) => {
    if (idx === items.length - 1) return;
    const updated = [...items];
    [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
    await save(updated);
  };

  const activeCount = items.filter((t) => t.active).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">{hint}</p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100 rounded-full px-2.5 py-1 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {activeCount} Aktif
            </span>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-sm font-semibold"
          >
            {addLabel}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <SettingsTable
        loading={loading}
        empty={items.length === 0}
        emptyText={`Henüz ${itemLabel.toLocaleLowerCase('tr-TR')} tanımlanmamış.`}
      >
        <SettingsTableHead>
          <SettingsRowIndexTh className="w-10" />
          <SettingsTableTh>{itemLabel}</SettingsTableTh>
          <SettingsTableTh>Kod</SettingsTableTh>
          <SettingsTableTh className="w-28 text-center">Durum</SettingsTableTh>
          <SettingsTableTh className="w-28 text-center">Sırala</SettingsTableTh>
          <SettingsTableTh className="w-28" />
        </SettingsTableHead>
        <SettingsTableBody>
          {items.map((type, idx) => (
            <SettingsTableRow key={type.code}>
              <SettingsRowIndexTd index={idx} className="text-xs" />
              <SettingsTableTd>
                <span
                  className={`font-medium ${
                    type.active ? 'text-slate-800' : 'text-slate-400 line-through'
                  }`}
                >
                  {type.label}
                </span>
              </SettingsTableTd>
              <SettingsTableTd>
                <code className="text-xs text-slate-500">{type.code}</code>
              </SettingsTableTd>
              <SettingsTableTd className="text-center">
                <button
                  type="button"
                  onClick={() => handleToggleActive(idx)}
                  disabled={saving}
                  title={type.active ? 'Pasif Yap' : 'Aktif Yap'}
                  className="inline-flex flex-col items-center gap-0.5 disabled:opacity-50"
                >
                  <StatusBadge active={type.active} />
                </button>
              </SettingsTableTd>
              <SettingsTableTd className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0 || saving}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors p-1 rounded hover:bg-slate-100"
                    title="Yukarı Taşı"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx === items.length - 1 || saving}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors p-1 rounded hover:bg-slate-100"
                    title="Aşağı Taşı"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </SettingsTableTd>
              <SettingsTableActions>
                <EditButton onClick={() => openEdit(idx)} />
                <DeleteButton onClick={() => setDeleteIdx(idx)} />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingIdx !== null ? `${itemLabel} Düzenle` : `Yeni ${itemLabel}`}
        onSave={handleSave}
        saving={saving}
        error={modalError}
      >
        <div>
          <label className={labelCls}>{itemLabel} Adı *</label>
          <input
            className={inputCls}
            placeholder={`Örn: ${defaults[0]?.label ?? 'Yeni Kayıt'}`}
            value={formLabel}
            onChange={(e) => {
              setFormLabel(e.target.value);
              setModalError('');
              if (editingIdx === null) {
                setFormCode(slugifyCode(e.target.value, ''));
              }
            }}
            onBlur={(e) => {
              const v = toTitleCaseTR(normalizeFormFreeText(e.target.value));
              if (v !== e.target.value.trim()) setFormLabel(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        </div>
        <div>
          <label className={labelCls}>Kod</label>
          <input
            className={inputCls}
            placeholder="ornek_kod"
            value={formCode}
            onChange={(e) =>
              setFormCode(
                e.target.value
                  .toLowerCase()
                  .replace(/\s+/g, '_')
                  .replace(/[^a-z0-9_]/g, ''),
              )
            }
          />
          <p className="mt-1 text-xs text-slate-400">
            Sistem içi anahtar. Boş bırakılırsa addan üretilir.
          </p>
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteIdx !== null}
        onClose={() => setDeleteIdx(null)}
        onConfirm={() => deleteIdx !== null && handleDelete(deleteIdx)}
        deleting={saving}
        itemName={deleteIdx !== null ? items[deleteIdx]?.label : undefined}
      />
    </section>
  );
}

export default function PersonelTanimlariPage() {
  return (
    <SettingsPageLayout
      title="Personel"
      description="İzin türleri ve zimmet kategorilerini tanımlayın. Bu listeler Personel Özlük ekranında kullanılır."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
    >
      <div className="space-y-10">
        <CatalogSection
          title="İzin Türleri"
          hint="Aktif izin türleri, Personel Özlük izin formunda ve vekalet seçiminde görünür. Pasif türler formlarda gösterilmez."
          endpoint="hr-leave-types"
          defaults={LEAVE_DEFAULTS}
          addLabel="Yeni İzin Türü"
          itemLabel="İzin Türü"
        />

        <div className="border-t border-slate-100" />

        <CatalogSection
          title="Zimmet Kategorileri"
          hint="Aktif kategoriler, zimmet ekleme formundaki kategori seçiminde görünür (ör. Cep Telefonu, Dizüstü)."
          endpoint="hr-asset-categories"
          defaults={ASSET_DEFAULTS}
          addLabel="Yeni Zimmet Kategorisi"
          itemLabel="Zimmet Kategorisi"
        />
      </div>
    </SettingsPageLayout>
  );
}
