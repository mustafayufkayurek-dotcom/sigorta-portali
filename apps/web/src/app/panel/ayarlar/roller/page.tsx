'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
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
import { FieldHelpTip } from '@/components/ui/FieldHelpTip';
import { normalizeFormFreeText } from '@/utils/text-helpers';
import {
  isLockedRoleAccountCode,
  roleAccountFamilyFromCode,
  roleAccountFamilyLabel,
  roleAccountKindLabel,
  type RoleAccountFamily,
} from '@sigorta/shared';

type Role = { id: string; code: string; name: string; description?: string | null; _count?: { users: number } };

const emptyForm = { name: '', description: '', accountFamily: '' as RoleAccountFamily | '' };

export default function RollerPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/roles`, { headers: authHeader() });
      setRoles(res.data.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const filtered = roles.filter((r) => {
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q)
      || (r.description ?? '').toLowerCase().includes(q)
      || roleAccountKindLabel(r.code).toLowerCase().includes(q)
      || roleAccountFamilyLabel(roleAccountFamilyFromCode(r.code)).toLowerCase().includes(q);
  });

  const meridyenRoles = useMemo(
    () => filtered.filter((r) => roleAccountFamilyFromCode(r.code) === 'meridyen'),
    [filtered],
  );
  const disRoles = useMemo(
    () => filtered.filter((r) => roleAccountFamilyFromCode(r.code) === 'dis'),
    [filtered],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  };
  const openEdit = (r: Role) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description ?? '',
      accountFamily: roleAccountFamilyFromCode(r.code),
    });
    setError('');
    setShowModal(true);
  };

  const setFamily = (family: RoleAccountFamily) => {
    if (editing) return;
    setForm((p) => ({ ...p, accountFamily: p.accountFamily === family ? '' : family }));
  };

  const handleSave = async () => {
    const name = normalizeFormFreeText(form.name);
    const description = form.description.trim() ? normalizeFormFreeText(form.description) : '';
    if (!name) { setError('Rol Adı zorunludur'); return; }
    if (!editing && !form.accountFamily) { setError('Hesap ailesi seçin'); return; }
    const dupName = roles.find((r) =>
      r.name.trim().toLowerCase() === name.toLowerCase() && (!editing || r.id !== editing.id)
    );
    if (dupName) { setError('Bu isimde bir rol zaten mevcut!'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`${API}/roles/${editing.id}`, { name, description: description || undefined }, { headers: authHeader() });
      } else {
        await axios.post(
          `${API}/roles`,
          { name, accountFamily: form.accountFamily, description: description || undefined },
          { headers: authHeader() },
        );
      }
      setShowModal(false); fetchRoles();
    } catch (e: any) { setError(e.response?.data?.message ?? 'Bir hata oluştu'); }
    finally { setSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError('');
    try {
      await axios.delete(`${API}/roles/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null); fetchRoles();
    } catch (e: any) { setDeleteError(e.response?.data?.message ?? 'Silinemedi'); }
    finally { setDeleting(false); }
  };

  const renderGroup = (title: string, hint: string, rows: Role[], indexOffset: number) => (
    <div className="mb-8">
      <div className="mb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <span>{title}</span>
          {hint ? <FieldHelpTip text={hint} /> : null}
        </h2>
      </div>
      <SettingsTable
        loading={loading}
        empty={!loading && rows.length === 0}
        emptyText={search ? 'Bu ailede aramaya uyan rol yok.' : 'Bu ailede henüz rol yok.'}
      >
        <SettingsTableHead>
          <SettingsRowIndexTh />
          <SettingsTableTh>Rol Adı</SettingsTableTh>
          <SettingsTableTh>Tür</SettingsTableTh>
          <SettingsTableTh>Açıklama</SettingsTableTh>
          <SettingsTableTh>Kullanıcı Sayısı</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {rows.map((r, index) => (
            <SettingsTableRow key={r.id}>
              <SettingsRowIndexTd index={indexOffset + index} />
              <SettingsTableTd><p className="text-sm font-medium text-slate-800">{r.name}</p></SettingsTableTd>
              <SettingsTableTd>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                  {roleAccountKindLabel(r.code)}
                </span>
              </SettingsTableTd>
              <SettingsTableTd>
                <p className="text-sm text-slate-500">{r.description || <span className="text-slate-300 italic">—</span>}</p>
              </SettingsTableTd>
              <SettingsTableTd>
                <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                  <span className="font-medium">{r._count?.users ?? 0}</span>
                  <span className="text-slate-400">kullanıcı</span>
                </span>
              </SettingsTableTd>
              <SettingsTableActions>
                <EditButton onClick={() => openEdit(r)} />
                {!isLockedRoleAccountCode(r.code) ? (
                  <DeleteButton onClick={() => { setDeleteTarget(r); setDeleteError(''); }} />
                ) : null}
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>
    </div>
  );

  const familyLocked = Boolean(editing);

  return (
    <SettingsPageLayout
      title="Rol Yönetimi"
      description="Personel ve dış hesap görevleri"
      addButtonText="+ Yeni Rol"
      onAdd={openCreate}
    >
      <div className="mb-4">
        <input
          className={`${inputCls} max-w-xs`}
          placeholder="Rol ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {renderGroup(
        'Meridyen Personeli',
        'Yönetici, dosya sorumlusu, finans ve saha bu listededir.',
        meridyenRoles,
        0,
      )}
      {renderGroup(
        'Dış Kullanıcı',
        'Sigorta, eksper, broker ve asistans bu listededir.',
        disRoles,
        meridyenRoles.length,
      )}

      <SettingsModal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'Rol Düzenle' : 'Yeni Rol'}
        onSave={handleSave} saving={saving} error={error}>
        <div>
          <label className={labelCls}>Rol Adı <span className="text-status-danger">*</span></label>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            onBlur={() => setForm((p) => ({ ...p, name: normalizeFormFreeText(p.name) }))}
            placeholder="Örn. bölge koordinatörü"
          />
        </div>
        <div>
          <label className={labelCls}>Hesap</label>
          <p className="text-xs text-slate-500 mb-2">Bu görevin hangi hesapta duracağını seçin.</p>
          <div className="space-y-2">
            <label className={`flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 ${familyLocked ? 'opacity-70' : 'cursor-pointer hover:bg-slate-50'}`}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-blue-500"
                checked={form.accountFamily === 'meridyen'}
                disabled={familyLocked}
                onChange={() => setFamily('meridyen')}
              />
              <span className="text-sm font-medium text-slate-800">Meridyen Personeli</span>
            </label>
            {form.accountFamily === 'meridyen' ? (
              <div className="ml-4 space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs text-slate-500">Yönetici, müdür, dosya sorumlusu, finans ve saha bu ailede durur. Yeni ad ayrı bir personel görevidir.</p>
              </div>
            ) : null}
            <label className={`flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 ${familyLocked ? 'opacity-70' : 'cursor-pointer hover:bg-slate-50'}`}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-blue-500"
                checked={form.accountFamily === 'dis'}
                disabled={familyLocked}
                onChange={() => setFamily('dis')}
              />
              <span className="text-sm font-medium text-slate-800">Dış Kullanıcı</span>
            </label>
            {form.accountFamily === 'dis' ? (
              <div className="ml-4 space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs text-slate-500">Sigorta şirketi, eksper, broker ve asistans bu ailede durur. Yeni ad ayrı bir dış görevdir.</p>
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <label className={labelCls}>Açıklama</label>
          <textarea className={`${inputCls} resize-none`} rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            onBlur={(e) => { const v = normalizeFormFreeText(e.target.value); if (v !== e.target.value.trim()) setForm((p) => ({ ...p, description: v })); }}
            placeholder="Opsiyonel açıklama" />
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(''); }}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
        itemName={deleteTarget?.name}
        error={deleteError}
        description={
          (deleteTarget?._count?.users ?? 0) > 0
            ? `Bu role ${deleteTarget?._count?.users} kullanıcı atanmış. Silme işlemi engellenecektir.`
            : undefined
        }
      />
    </SettingsPageLayout>
  );
}
