'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { normalizeFormFreeText } from '@/utils/text-helpers';
import {
  RELATIONSHIP_CUSTOMER_CHILDREN,
  RELATIONSHIP_VENDOR_CHILDREN,
  isRelationshipCustomerParentOn,
  isRelationshipVendorParentOn,
  relationshipUsageDisplayLabels,
  toggleRelationshipCustomerChild,
  toggleRelationshipUsageParent,
  toggleRelationshipVendorChild,
} from '@/utils/relationship-type-usage';

type UsageArea = string;

interface RelationshipType {
  label: string;
  active: boolean;
  usageAreas?: UsageArea[];
}

export default function IliskiTurleriPage() {
  const [types, setTypes] = useState<RelationshipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formUsageAreas, setFormUsageAreas] = useState<UsageArea[]>([]);
  const [modalError, setModalError] = useState('');

  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/relationship-types`, { headers: authHeader() });
      const data = res.data.data ?? [];
      if (data.length > 0 && typeof data[0] === 'string') {
        setTypes((data as string[]).map((label: string) => ({ label, active: true, usageAreas: [] })));
      } else {
        setTypes(data as RelationshipType[]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const save = async (updated: RelationshipType[]) => {
    setSaving(true);
    setError('');
    try {
      await axios.put(`${API}/system-settings/relationship-types`, { values: updated }, { headers: authHeader() });
      setTypes(updated);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Kaydedilemedi');
    } finally { setSaving(false); }
  };

  const openCreate = () => {
    setEditingIdx(null);
    setFormLabel('');
    setFormUsageAreas([]);
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (idx: number) => {
    setEditingIdx(idx);
    setFormLabel(types[idx].label);
    setFormUsageAreas(types[idx].usageAreas ?? []);
    setModalError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const val = normalizeFormFreeText(formLabel);
    if (!val) { setModalError('Boş değer girilemez'); return; }
    const usageAreas = formUsageAreas.filter((area) => area !== 'dosya');
    if (editingIdx === null) {
      if (types.some((t) => t.label === val)) { setModalError('Bu tür zaten mevcut'); return; }
      await save([...types, { label: val, active: true, usageAreas }]);
    } else {
      if (types.some((t, i) => i !== editingIdx && t.label === val)) { setModalError('Bu tür zaten mevcut'); return; }
      const updated = types.map((t, i) => (i === editingIdx ? { ...t, label: val, usageAreas } : t));
      await save(updated);
    }
    setShowModal(false);
  };

  const handleDelete = async (idx: number) => {
    await save(types.filter((_, i) => i !== idx));
    setDeleteIdx(null);
  };

  const handleToggleActive = async (idx: number) => {
    const updated = types.map((t, i) => i === idx ? { ...t, active: !t.active } : t);
    await save(updated);
  };

  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const updated = [...types];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    await save(updated);
  };

  const handleMoveDown = async (idx: number) => {
    if (idx === types.length - 1) return;
    const updated = [...types];
    [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
    await save(updated);
  };

  const activeCount = types.filter((t) => t.active).length;

  return (
    <SettingsPageLayout
      title="İlişki Türleri"
      description="Müşteri ve tedarikçi kartında işaretlenen alt türler görünür"
      addButtonText="Yeni İlişki Türü"
      onAdd={openCreate}
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <div className="flex items-center gap-2">
          {types.length > 0 ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100 rounded-full px-2.5 py-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {activeCount} Aktif
            </span>
            {types.length - activeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                {types.length - activeCount} Pasif
              </span>
            )}
          </div>
          ) : null}
        </div>
      }
    >
      {error && <p className="mb-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700">
        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>
          Müşteri işaretlenince altı açılır: Sigortalı, Eksper, Sigorta Şirketi, Asistans Firma, Özel Müşteri.
          Tedarikçi işaretlenince altı açılır: Acil Yardım, Hasar Onarım.
          Alt seçilmezse o gruptaki tüm kartlarda durur. Pasif tür hiçbir kartta görünmez.
        </p>
      </div>

      <SettingsTable loading={loading} empty={types.length === 0} emptyText="Henüz ilişki türü tanımlanmamış.">
        <SettingsTableHead>
          <SettingsRowIndexTh className="w-10" />
          <SettingsTableTh>İlişki Türü</SettingsTableTh>
          <SettingsTableTh>Kullanım Alanı</SettingsTableTh>
          <SettingsTableTh className="w-28 text-center">Durum</SettingsTableTh>
          <SettingsTableTh className="w-28 text-center">Sırala</SettingsTableTh>
          <SettingsTableTh className="w-28" />
        </SettingsTableHead>
        <SettingsTableBody>
          {types.map((type, idx) => (
            <SettingsTableRow key={idx}>
              <SettingsRowIndexTd index={idx} className="text-xs" />
              <SettingsTableTd>
                <span className={`font-medium ${type.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                  {type.label}
                </span>
              </SettingsTableTd>
              <SettingsTableTd>
                {relationshipUsageDisplayLabels(type.usageAreas).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {relationshipUsageDisplayLabels(type.usageAreas).map((label) => (
                      <span key={label} className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                        {label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
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
                  <button type="button" onClick={() => handleMoveUp(idx)} disabled={idx === 0 || saving}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors p-1 rounded hover:bg-slate-100" title="Yukarı Taşı">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button type="button" onClick={() => handleMoveDown(idx)} disabled={idx === types.length - 1 || saving}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors p-1 rounded hover:bg-slate-100" title="Aşağı Taşı">
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
        title={editingIdx !== null ? 'İlişki Türü Düzenle' : 'Yeni İlişki Türü'}
        onSave={handleSave}
        saving={saving}
        error={modalError}
      >
        <div>
          <label className={labelCls}>İlişki Türü Adı *</label>
          <input
            className={inputCls}
            placeholder="Örn. sekreter"
            value={formLabel}
            onChange={(e) => { setFormLabel(e.target.value); setModalError(''); }}
            onBlur={(e) => {
              const v = normalizeFormFreeText(e.target.value);
              if (v !== e.target.value.trim()) setFormLabel(v);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
          />
        </div>

        <div>
          <label className={labelCls}>Kullanım Alanları</label>
          <p className="text-xs text-slate-500 mb-2">Bu türün hangi kartta duracağını seçin.</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-blue-500"
                checked={isRelationshipCustomerParentOn(formUsageAreas)}
                onChange={() => setFormUsageAreas((prev) => toggleRelationshipUsageParent(prev, 'musteri'))}
              />
              <span className="text-sm font-medium text-slate-800">Müşteri</span>
            </label>
            {isRelationshipCustomerParentOn(formUsageAreas) ? (
              <div className="ml-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs text-slate-500">Müşteri Statüsü. Boş bırakılırsa tüm müşteri kartlarında durur.</p>
                {RELATIONSHIP_CUSTOMER_CHILDREN.map((child) => (
                  <label key={child.value} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-blue-500"
                      checked={formUsageAreas.includes(child.value)}
                      onChange={() => setFormUsageAreas((prev) => toggleRelationshipCustomerChild(prev, child.value))}
                    />
                    <span className="text-sm text-slate-700">{child.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
            <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-blue-500"
                checked={isRelationshipVendorParentOn(formUsageAreas)}
                onChange={() => setFormUsageAreas((prev) => toggleRelationshipUsageParent(prev, 'tedarikci'))}
              />
              <span className="text-sm font-medium text-slate-800">Tedarikçi</span>
            </label>
            {isRelationshipVendorParentOn(formUsageAreas) ? (
              <div className="ml-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs text-slate-500">Tedarikçi Statüsü. Boş bırakılırsa tüm tedarikçi kartlarında durur.</p>
                {RELATIONSHIP_VENDOR_CHILDREN.map((child) => (
                  <label key={child.value} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-blue-500"
                      checked={formUsageAreas.includes(child.value)}
                      onChange={() => setFormUsageAreas((prev) => toggleRelationshipVendorChild(prev, child.value))}
                    />
                    <span className="text-sm text-slate-700">{child.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteIdx !== null}
        onClose={() => setDeleteIdx(null)}
        onConfirm={() => deleteIdx !== null && handleDelete(deleteIdx)}
        deleting={saving}
        itemName={deleteIdx !== null ? types[deleteIdx]?.label : undefined}
      />
    </SettingsPageLayout>
  );
}
