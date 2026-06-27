'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  DeleteButton,
  EditButton,
  SettingsTable,
  SettingsTableActions,
  SettingsTableBody,
  SettingsTableHead,
  SettingsTableRow,
  SettingsTableTd,
  SettingsTableTh,
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { DeleteConfirmDialog, SettingsModal } from '@/components/settings/SettingsModal';
import { ApiError, apiClient } from '@/lib/api-client';
import { applyNameWithAutoCode, suggestAutoCode } from '@/utils/auto-code';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';

type ClaimStatus = {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  color: string;
  isClosed: boolean;
  isWaiting: boolean;
  slaWarningPercent: number;
  slaEnabled?: boolean;
  sendNotification?: boolean;
};

type ClaimStatusForm = {
  name: string;
  code: string;
  sortOrder: number;
  color: string;
  isClosed: boolean;
  isWaiting: boolean;
  slaWarningPercent: number;
  slaEnabled: boolean;
  sendNotification: boolean;
};

const emptyForm: ClaimStatusForm = {
  name: '',
  code: '',
  sortOrder: 0,
  color: '#2563EB',
  isClosed: false,
  isWaiting: false,
  slaWarningPercent: 80,
  slaEnabled: true,
  sendNotification: false,
};

function normalizeClaimStatus(item: Record<string, unknown>): ClaimStatus {
  return {
    id: String(item.id ?? ''),
    name: String(item.name ?? item.ad ?? ''),
    code: String(item.code ?? item.kod ?? ''),
    sortOrder: Number(item.sortOrder ?? item.order ?? item.siraNo ?? 0),
    color: String(item.color ?? item.renk ?? '#2563EB'),
    isClosed: Boolean(item.isClosed ?? item.closed ?? item.kapaliDurumu ?? false),
    isWaiting: Boolean(item.isWaiting ?? item.waiting ?? item.beklemeDurumu ?? false),
    slaWarningPercent: Number(item.slaWarningPercent ?? item.slaWarningPercentage ?? item.slaUyariYuzdesi ?? 0),
    slaEnabled: Boolean(item.slaEnabled ?? item.slaAktif ?? true),
    sendNotification: Boolean(item.sendNotification ?? item.bildirimGonder ?? false),
  };
}

function toPayload(form: ClaimStatusForm) {
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    sortOrder: Number(form.sortOrder),
    color: form.color,
    isClosed: form.isClosed,
    isWaiting: form.isWaiting,
    slaWarningPercent: Number(form.slaWarningPercent),
    slaEnabled: form.slaEnabled,
    sendNotification: form.sendNotification,
  };
}

export default function DurumlarPage() {
  const [statuses, setStatuses] = useState<ClaimStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClaimStatus | null>(null);
  const [form, setForm] = useState<ClaimStatusForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClaimStatus | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const sortedStatuses = useMemo(
    () => [...statuses].sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name, 'tr')),
    [statuses],
  );

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<unknown[]>('/claim-status');
      setStatuses(Array.isArray(data) ? data.map((item) => normalizeClaimStatus(item as Record<string, unknown>)) : []);
    } catch (requestError) {
      console.error(requestError);
      setError('Durum listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (status: ClaimStatus) => {
    setEditing(status);
    setForm({
      name: status.name,
      code: status.code,
      sortOrder: status.sortOrder,
      color: status.color,
      isClosed: status.isClosed,
      isWaiting: status.isWaiting,
      slaWarningPercent: status.slaWarningPercent,
      slaEnabled: status.slaEnabled ?? true,
      sendNotification: status.sendNotification ?? false,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const code = editing ? form.code.trim() : (form.code.trim() || suggestAutoCode('DURUM', form.name));
    if (!form.name.trim() || !code) {
      setError('Ad ve Kod zorunludur.');
      return;
    }

    const duplicate = statuses.find((status) => {
      if (editing && status.id === editing.id) return false;
      return status.code.trim().toUpperCase() === code.toUpperCase();
    });

    if (duplicate) {
      setError('Bu kod ile kayıtlı başka bir durum mevcut.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = toPayload({ ...form, code });
      if (editing) {
        await apiClient.put?.<ClaimStatus>(`/claim-status/${editing.id}`, payload);
      } else {
        await apiClient.post<ClaimStatus>('/claim-status', payload);
      }
      setShowModal(false);
      resetForm();
      await fetchStatuses();
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message || 'Kayıt işlemi başarısız.');
      } else {
        setError('Kayıt işlemi başarısız.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError('');

    try {
      await apiClient.delete(`/claim-status/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchStatuses();
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setDeleteError(requestError.message || 'Silme işlemi başarısız.');
      } else {
        setDeleteError('Silme işlemi başarısız.');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPageLayout
      title="Durumlar"
      description="Hasar ve operasyon dosyalarının ekranda hangi aşamada görüneceğini, kapanmış veya beklemede sayılıp sayılmayacağını ve takip sırasını yönetin."
      addButtonText="Yeni Durum"
      onAdd={openCreate}
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
    >
      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100">
        Bu sayfa dosya akışındaki durum etiketlerini yönetir. Buradaki kayıtlar dashboard sayıları, dosya listesi filtreleri,
        bekleme/kapanış ayrımları ve süreç sıralaması üzerinde etkilidir.
      </div>

      {error && !showModal && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <SettingsTable loading={loading} empty={sortedStatuses.length === 0} emptyText="Henüz durum tanımlanmamış.">
        <SettingsTableHead>
          <SettingsTableTh className="w-20">Sıra No</SettingsTableTh>
          <SettingsTableTh>Ad</SettingsTableTh>
          <SettingsTableTh className="w-24">Renk</SettingsTableTh>
          <SettingsTableTh className="w-32">Kapalı Durumu</SettingsTableTh>
          <SettingsTableTh className="w-32">Bekleme Durumu</SettingsTableTh>
          <SettingsTableTh className="w-28">SLA Uyarı %</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {sortedStatuses.map((status) => (
            <SettingsTableRow key={status.id}>
              <SettingsTableTd className="font-mono text-xs text-slate-500">{status.sortOrder}</SettingsTableTd>
              <SettingsTableTd>
                <div className="space-y-1">
                  <p className="font-medium text-slate-800">{status.name}</p>
                  <p className="text-xs text-slate-400">{status.code}</p>
                </div>
              </SettingsTableTd>
              <SettingsTableTd>
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded border border-slate-200" style={{ backgroundColor: status.color }} />
                  <span className="text-xs text-slate-500">{status.color}</span>
                </div>
              </SettingsTableTd>
              <SettingsTableTd>{status.isClosed ? 'Evet' : 'Hayır'}</SettingsTableTd>
              <SettingsTableTd>{status.isWaiting ? 'Evet' : 'Hayır'}</SettingsTableTd>
              <SettingsTableTd>%{status.slaWarningPercent}</SettingsTableTd>
              <SettingsTableActions>
                <EditButton onClick={() => openEdit(status)} />
                <DeleteButton onClick={() => { setDeleteTarget(status); setDeleteError(''); }} />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editing ? 'Durum Düzenle' : 'Yeni Durum'}
        onSave={handleSave}
        saving={saving}
        error={error}
        maxWidth="lg"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>Ad</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(event) =>
                setForm((current) => applyNameWithAutoCode(current, event.target.value, !!editing, 'DURUM'))
              }
              placeholder="Örn: İncelemede"
            />
          </div>
          <div>
            <label className={labelCls}>Kod</label>
            <input
              className={`${inputCls} disabled:bg-slate-50`}
              value={form.code}
              disabled
              placeholder={editing ? 'ORN: INCELEMEDE' : 'Ad yazınca otomatik üretilir'}
            />
          </div>
          <div>
            <label className={labelCls}>Sıra No</label>
            <input
              className={inputCls}
              type="number"
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
              min={0}
            />
          </div>
          <div>
            <label className={labelCls}>Renk</label>
            <div className="flex items-center gap-3">
              <input
                className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                type="color"
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
              />
              <input
                className={inputCls}
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                placeholder="#2563EB"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">SLA Ayarları</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>SLA Uyarı Yüzdesi</label>
              <input
                className={inputCls}
                type="number"
                min={0}
                max={100}
                value={form.slaWarningPercent}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slaWarningPercent: Number(event.target.value) }))
                }
              />
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.slaEnabled}
                onChange={(event) => setForm((current) => ({ ...current, slaEnabled: event.target.checked }))}
              />
              SLA takibi aktif
            </label>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isClosed}
              onChange={(event) => setForm((current) => ({ ...current, isClosed: event.target.checked }))}
            />
            Kapalı durum
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isWaiting}
              onChange={(event) => setForm((current) => ({ ...current, isWaiting: event.target.checked }))}
            />
            Bekleme durumu
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.sendNotification}
              onChange={(event) => setForm((current) => ({ ...current, sendNotification: event.target.checked }))}
            />
            Bildirim gönder
          </label>
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        itemName={deleteTarget?.name}
        error={deleteError}
        title="Durumu Sil"
      />
    </SettingsPageLayout>
  );
}
