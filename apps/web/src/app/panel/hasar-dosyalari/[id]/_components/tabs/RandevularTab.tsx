'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { API, authHeader } from '../claim-detail-utils';
import { FinansFormPanel, FinansPanelCard } from '@/components/finance/FinansPanelUI';

// ─── Tab: Randevular ──────────────────────────────────────────────────────────

const APPOINTMENT_TYPE_LABEL: Record<string, string> = {
  customer_visit: 'Sigortalı Ziyareti',
  inspection: 'Keşif',
  site_visit: 'Saha Ziyareti',
  meeting: 'Toplantı',
  other: 'Diğer',
};

const APPOINTMENT_STATUS_COLOR: Record<string, string> = {
  planned: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  planned: 'Planlandı',
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

export function RandevularTab({ claimId, claim }: { claimId: string; claim: any }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    type: 'customer_visit',
    scheduledAt: '',
    scheduledEnd: '',
    location: '',
    notes: '',
    assignedUserId: '',
    vendorId: '',
  });
  const [notifLoading, setNotifLoading] = useState<string | null>(null);

  const loadAppointments = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/adjusters/appointments/claim/${claimId}`, { headers: authHeader() })
      .then((r) => setAppointments(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  useEffect(() => {
    if (!showForm) return;
    // Tedarikçi önerisi
    const city = claim?.propertyAddress?.city;
    if (city) {
      axios.get(`${API}/vendors/suggest?city=${encodeURIComponent(city)}`, { headers: authHeader() })
        .then((r) => setVendors(r.data.data || []))
        .catch(() => setVendors([]));
    }
    // Kullanıcı listesi
    axios.get(`${API}/users?limit=100`, { headers: authHeader() })
      .then((r) => setUsers(r.data.data || []))
      .catch(() => setUsers([]));
  }, [showForm, claim]);

  const handleSave = async () => {
    if (!form.scheduledAt) return alert('Lütfen randevu tarih/saatini giriniz.');
    setSaving(true);
    try {
      await axios.post(`${API}/adjusters/appointments`, {
        claimFileId: claimId,
        ...form,
        assignedUserId: form.assignedUserId || undefined,
        vendorId: form.vendorId || undefined,
        scheduledEnd: form.scheduledEnd || undefined,
        location: form.location || undefined,
        notes: form.notes || undefined,
      }, { headers: authHeader() });
      setShowForm(false);
      setForm({ type: 'customer_visit', scheduledAt: '', scheduledEnd: '', location: '', notes: '', assignedUserId: '', vendorId: '' });
      loadAppointments();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (apptId: string, status: string) => {
    try {
      await axios.patch(`${API}/adjusters/appointments/${apptId}/status`, { status }, { headers: authHeader() });
      loadAppointments();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Durum güncellenemedi');
    }
  };

  const handleSendNotification = async (apptId: string, channel: 'sms' | 'whatsapp') => {
    setNotifLoading(`${apptId}-${channel}`);
    try {
      const r = await axios.post(`${API}/adjusters/appointments/${apptId}/send-notification`, { channel }, { headers: authHeader() });
      if (channel === 'whatsapp' && r.data.data?.waUrl) {
        window.open(r.data.data.waUrl, '_blank');
      } else {
        alert('SMS bildirimleri gönderildi.');
      }
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Bildirim gönderilemedi');
    } finally {
      setNotifLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <FinansPanelCard
        title="Randevular"
        subtitle="Planlanan ziyaret ve toplantılar"
        action={{
          label: showForm ? 'Formu Kapat' : 'Randevu Ekle',
          onClick: () => setShowForm(!showForm),
          active: showForm,
        }}
      >
      {showForm && (
        <FinansFormPanel
          title="Yeni Randevu"
          onCancel={() => setShowForm(false)}
          onSubmit={handleSave}
          saving={saving}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Randevu Tipi</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {Object.entries(APPOINTMENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Başlangıç Tarih/Saat</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Bitiş Tarih/Saat (Opsiyonel)</label>
              <input type="datetime-local" value={form.scheduledEnd} onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Sorumlu Personel</label>
              <select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">— Seçiniz —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Tedarikçi (Opsiyonel)</label>
              <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">— Seçiniz —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name} {v.stats?.activeJobs != null ? `(${v.stats.activeJobs} aktif iş)` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Konum</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Adres veya Konum" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Notlar</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm({ ...form, notes: v }); }} rows={2} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>
        </FinansFormPanel>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Yükleniyor...</div>
      ) : appointments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">Henüz Randevu Eklenmemiş</div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <div key={appt.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-slate-800">{APPOINTMENT_TYPE_LABEL[appt.type] ?? appt.type}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${APPOINTMENT_STATUS_COLOR[appt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {APPOINTMENT_STATUS_LABEL[appt.status] ?? appt.status}
                    </span>
                    {appt.notifiedAt && <span className="text-xs text-slate-400">Bildirim: {new Date(appt.notifiedAt).toLocaleDateString('tr-TR')}</span>}
                  </div>
                  <p className="text-sm text-slate-600">
                    {new Date(appt.scheduledAt).toLocaleString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {appt.scheduledEnd && ` — ${new Date(appt.scheduledEnd).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                  {appt.location && <p className="text-xs text-slate-400 mt-0.5">Konum: {appt.location}</p>}
                  <div className="flex gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                    {appt.assignedUser && <span>Sorumlu: {appt.assignedUser.firstName} {appt.assignedUser.lastName}</span>}
                    {appt.vendor && <span>Tedarikçi: {appt.vendor.name}</span>}
                    {appt.adjuster && <span>Eksper: {appt.adjuster.name}</span>}
                  </div>
                  {appt.notes && <p className="text-xs text-slate-400 mt-1 italic">{appt.notes}</p>}
                  {/* Check-in / Check-out bilgisi */}
                  {appt.checkedInAt && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="text-green-600 font-medium">
                        Check-in: {new Date(appt.checkedInAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {appt.checkedInLatitude && appt.checkedInLongitude && (
                        <a
                          href={`https://www.google.com/maps?q=${appt.checkedInLatitude},${appt.checkedInLongitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 underline"
                        >
                          Haritada Gör
                        </a>
                      )}
                      {appt.checkedOutAt && (
                        <>
                          <span className="text-red-500 font-medium">
                            Check-out: {new Date(appt.checkedOutAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>
                            Süre: {Math.round((new Date(appt.checkedOutAt).getTime() - new Date(appt.checkedInAt).getTime()) / 60_000)} dk
                          </span>
                        </>
                      )}
                      {!appt.checkedOutAt && (
                        <span className="text-orange-500 font-medium">Sahada (Devam Ediyor)</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 items-end shrink-0">
                  {/* Durum geçişi */}
                  {appt.status === 'planned' && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => handleStatusChange(appt.id, 'confirmed')} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Onayla</button>
                      <button type="button" onClick={() => handleStatusChange(appt.id, 'cancelled')} className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">İptal</button>
                    </div>
                  )}
                  {appt.status === 'confirmed' && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => handleStatusChange(appt.id, 'completed')} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Tamamlandı</button>
                      <button type="button" onClick={() => handleStatusChange(appt.id, 'cancelled')} className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">İptal</button>
                    </div>
                  )}
                  {/* Bildirim butonları — confirmed randevularda aktif */}
                  <div className="flex gap-1">
                    <button type="button"
                      onClick={() => handleSendNotification(appt.id, 'sms')}
                      disabled={appt.status !== 'confirmed' || notifLoading === `${appt.id}-sms`}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={appt.status !== 'confirmed' ? 'Yalnızca onaylanmış randevular için aktif' : 'SMS Gönder'}
                    >
                      {notifLoading === `${appt.id}-sms` ? '...' : 'SMS'}
                    </button>
                    <button type="button"
                      onClick={() => handleSendNotification(appt.id, 'whatsapp')}
                      disabled={appt.status !== 'confirmed' || notifLoading === `${appt.id}-whatsapp`}
                      className="px-2.5 py-1 text-xs border border-green-200 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={appt.status !== 'confirmed' ? 'Yalnızca onaylanmış randevular için aktif' : 'WhatsApp Gönder'}
                    >
                      {notifLoading === `${appt.id}-whatsapp` ? '...' : 'WhatsApp'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </FinansPanelCard>
    </div>
  );
}
