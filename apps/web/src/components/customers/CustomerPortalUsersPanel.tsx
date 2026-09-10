'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { PhoneInput } from '@/components/PhoneInput';
import { toTitleCaseTR } from '@/utils/text-helpers';
import {
  displayPersonDuty,
  emptyInvitePersonDraft,
  invitePeopleToSubmit,
  isInvitePersonBlank,
  type InvitePersonDraft,
} from '@/app/panel/kullanicilar/_lib/user-invite-config';

type PortalUserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  status?: string | null;
  role?: { code?: string | null; name?: string | null } | null;
};

type InviteResult = {
  email: string;
  temporaryPassword: string;
  mailMessage: string;
};

const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

export function CustomerPortalUsersPanel({
  customerId,
  canInvite,
}: {
  customerId: string;
  canInvite: boolean;
}) {
  const [users, setUsers] = useState<PortalUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<InvitePersonDraft[]>([emptyInvitePersonDraft()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [personErrors, setPersonErrors] = useState<Record<string, { firstName?: string; lastName?: string; email?: string; jobTitle?: string }>>({});
  const [invites, setInvites] = useState<InviteResult[] | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    axios
      .get(`${API}/users`, { headers: authHeader(), params: { customerId, limit: 100 } })
      .then((res) => setUsers(res.data?.data ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const updatePerson = (key: string, patch: Partial<InvitePersonDraft>) => {
    setPeople((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setPersonErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setError('');
  };

  const submit = async () => {
    const rows = invitePeopleToSubmit(people);
    const nextErrors: Record<string, { firstName?: string; lastName?: string; email?: string; jobTitle?: string }> = {};
    const seen = new Set<string>();
    for (const person of rows) {
      const row: { firstName?: string; lastName?: string; email?: string; jobTitle?: string } = {};
      if (!person.firstName.trim()) row.firstName = 'Ad zorunludur.';
      if (!person.lastName.trim()) row.lastName = 'Soyad zorunludur.';
      if (!person.jobTitle.trim()) row.jobTitle = 'Görev yazılmalıdır.';
      if (!person.email.trim()) row.email = 'E-posta zorunludur.';
      else {
        const email = person.email.trim().toLowerCase();
        if (seen.has(email)) row.email = 'Bu e-posta bu davette tekrar ediyor.';
        seen.add(email);
      }
      if (Object.keys(row).length > 0) nextErrors[person.key] = row;
    }
    setPersonErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Her kişi için ad, soyad, e-posta ve görev doldurulmalıdır.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await axios.post(
        `${API}/users/portal-invite/${customerId}`,
        {
          people: rows.map((person) => ({
            firstName: person.firstName.trim(),
            lastName: person.lastName.trim(),
            email: person.email.trim(),
            phone: person.phone.trim() || undefined,
            jobTitle: person.jobTitle.trim(),
          })),
        },
        { headers: authHeader() },
      );
      const invited = response.data?.data?.invited ?? [];
      if (!Array.isArray(invited) || invited.length === 0) {
        setError('Davet tamamlanamadı.');
        return;
      }
      const missingPassword = invited.find((row: { temporaryPassword?: string }) => !row.temporaryPassword);
      if (missingPassword) {
        setError('Kullanıcı oluştu ancak geçici şifre görüntülenemedi.');
      }
      setInvites(invited.map((row: { email: string; temporaryPassword: string; welcomeEmail?: { message?: string } }) => ({
        email: row.email,
        temporaryPassword: row.temporaryPassword,
        mailMessage: row.welcomeEmail?.message ?? 'Hoş geldin maili gönderimi denendi.',
      })));
      setPeople([emptyInvitePersonDraft()]);
      load();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.response?.data?.error ?? 'Davet gönderilemedi.')
        : 'Davet gönderilemedi.';
      setError(Array.isArray(message) ? message.join(' ') : String(message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50">
        <h4 className="text-sm font-semibold text-slate-800">Firma kullanıcıları</h4>
        <p className="text-xs text-slate-400 mt-0.5">
          Panele giren kişiler. Yetkili kişiler ayrıdır; onlara giriş açılmaz.
        </p>
      </div>
      <div className="p-5 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-4">Yükleniyor...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Bu kartta henüz kullanıcı yok.</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <a
                key={user.id}
                href={`/panel/kullanicilar/${user.id}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 hover:border-emerald-200"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{displayPersonDuty(user)}</p>
                  <p className="mt-1 text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <span className="text-xs text-emerald-700 font-medium shrink-0">Aç</span>
              </a>
            ))}
          </div>
        )}

        {canInvite && (
          <div className="space-y-3 border-t border-slate-50 pt-4">
            <p className="text-sm font-semibold text-slate-800">Kullanıcı davet et</p>
            <p className="text-xs leading-5 text-slate-500">
              Görev bu kişinindir; siz yazarsınız. Hoş geldin maili ve geçici şifre Kullanıcılar e-postasına gider.
            </p>
            {invites && invites.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-emerald-900">Davet gönderildi</p>
                {invites.map((row) => (
                  <div key={row.email} className="text-xs text-emerald-900">
                    <p className="font-medium">{row.email}</p>
                    <p className="mt-0.5">Geçici şifre: {row.temporaryPassword}</p>
                    <p className="mt-0.5 text-emerald-800">{row.mailMessage}</p>
                  </div>
                ))}
              </div>
            )}
            {people.map((person, index) => (
              <div key={person.key} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">{index + 1}. kişi</p>
                  {people.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPeople((prev) => prev.filter((row) => row.key !== person.key))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Kişiyi kaldır"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Ad</label>
                    <input
                      type="text"
                      value={person.firstName}
                      onChange={(e) => updatePerson(person.key, { firstName: e.target.value })}
                      onBlur={(e) => {
                        const v = toTitleCaseTR(e.target.value.trim());
                        if (v) updatePerson(person.key, { firstName: v });
                      }}
                      className={inputCls}
                      placeholder="Ad"
                    />
                    {personErrors[person.key]?.firstName && (
                      <p className="mt-1 text-xs text-red-600">{personErrors[person.key]?.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Soyad</label>
                    <input
                      type="text"
                      value={person.lastName}
                      onChange={(e) => updatePerson(person.key, { lastName: e.target.value })}
                      onBlur={(e) => {
                        const v = toTitleCaseTR(e.target.value.trim());
                        if (v) updatePerson(person.key, { lastName: v });
                      }}
                      className={inputCls}
                      placeholder="Soyad"
                    />
                    {personErrors[person.key]?.lastName && (
                      <p className="mt-1 text-xs text-red-600">{personErrors[person.key]?.lastName}</p>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Görev</label>
                    <input
                      type="text"
                      value={person.jobTitle}
                      onChange={(e) => updatePerson(person.key, { jobTitle: e.target.value })}
                      onBlur={(e) => {
                        const v = toTitleCaseTR(e.target.value.trim());
                        if (v) updatePerson(person.key, { jobTitle: v });
                      }}
                      className={inputCls}
                      placeholder="Görev"
                      maxLength={80}
                    />
                    {personErrors[person.key]?.jobTitle && (
                      <p className="mt-1 text-xs text-red-600">{personErrors[person.key]?.jobTitle}</p>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-slate-600">E-posta</label>
                    <input
                      type="email"
                      value={person.email}
                      onChange={(e) => updatePerson(person.key, { email: e.target.value })}
                      className={inputCls}
                      placeholder="ornek@sirket.com"
                    />
                    {personErrors[person.key]?.email && (
                      <p className="mt-1 text-xs text-red-600">{personErrors[person.key]?.email}</p>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Telefon</label>
                    <PhoneInput value={person.phone} onChange={(v) => updatePerson(person.key, { phone: v })} />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPeople((prev) => [...prev, emptyInvitePersonDraft()])}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <Plus className="h-4 w-4" />
              Kişi Ekle
            </button>
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={saving || (people.length === 1 && isInvitePersonBlank(people[0]!))}
              className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Gönderiliyor...' : 'Davet Gönder'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
