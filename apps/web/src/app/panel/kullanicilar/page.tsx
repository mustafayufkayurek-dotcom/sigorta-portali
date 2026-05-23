'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { API, authHeader } from '@/utils/api';

const PROTECTED_ADMIN_EMAIL = 'admin@example.com';

// ── Tipler ──────────────────────────────────────────────────────────────────

interface Role {
  id: string;
  name: string;
  code: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: string; // 'active' | 'inactive' | 'suspended'
  role?: Role | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

type FormErrors = Partial<Record<keyof UserFormState, string>> & { general?: string };

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  roleId: string;
}

const DEFAULT_FORM: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  roleId: '',
};

// ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

function statusLabel(status: string) {
  if (status === 'active') return 'Aktif';
  if (status === 'inactive') return 'Pasif';
  return 'Askıya Alındı';
}

function statusBadgeCls(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'inactive') return 'bg-slate-100 text-slate-500';
  return 'bg-red-100 text-red-600';
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Bileşenler ───────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls =
  'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 transition-all';

// ── Ana Sayfa ────────────────────────────────────────────────────────────────

function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? payload.id ?? null;
  } catch {
    return null;
  }
}

export default function KullanicilarPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterRoleId, setFilterRoleId] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Seçim (toplu işlem)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal durumları
  const [modal, setModal] = useState<'add' | 'edit' | 'resetPwd' | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Şifre sıfırlama
  const [resetPwd, setResetPwd] = useState('');
  const [resetPwdError, setResetPwdError] = useState('');

  // ── Veri yükleme ──────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      const r = await axios.get(`${API}/users`, {
        headers: authHeader(),
        params,
      });
      const list = r.data?.data ?? r.data ?? [];
      setUsers(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('[Kullanicilar] loadUsers hata:', err?.response?.status, err?.response?.data ?? err?.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/roles`, { headers: authHeader() });
      setRoles(r.data.data ?? []);
    } catch {
      setRoles([]);
    }
  }, []);

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
    loadUsers();
    loadRoles();
  }, [loadUsers, loadRoles]);

  // ── Filtreli liste ────────────────────────────────────────────────────────

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.role?.name ?? '').toLowerCase().includes(q);
    const matchStatus = !filterStatus || u.status === filterStatus;
    const matchRole = !filterRoleId || u.role?.id === filterRoleId;
    return matchSearch && matchStatus && matchRole;
  });

  // ── Seçim işlemleri ───────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(
        new Set(
          filtered
            .filter((u) => u.email !== PROTECTED_ADMIN_EMAIL && u.id !== currentUserId)
            .map((u) => u.id),
        ),
      );
    }
  };

  const handleBulkDelete = async () => {
    const ids = filtered
      .filter((u) => selected.has(u.id))
      .map((u) => u.id)
      .filter(Boolean);

    if (ids.length === 0) return;

    const confirmed = window.confirm(`${ids.length} kullanıcı silinecek, emin misiniz?`);
    if (!confirmed) return;

    setBulkDeleting(true);
    try {
      await axios.post(
        `${API}/users/bulk-delete`,
        { ids },
        { headers: authHeader() },
      );
      setSelected(new Set());
      await loadUsers();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? 'Toplu silme sırasında hata oluştu.');
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Modal yönetimi ────────────────────────────────────────────────────────

  const openAdd = () => {
    setForm(DEFAULT_FORM);
    setFormError('');
    setFormErrors({});
    setEditingUser(null);
    setModal('add');
  };

  const openEdit = (u: User) => {
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone ?? '',
      password: '',
      roleId: u.role?.id ?? '',
    });
    setFormError('');
    setFormErrors({});
    setEditingUser(u);
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditingUser(null);
    setForm(DEFAULT_FORM);
    setFormError('');
    setFormErrors({});
    setResetPwd('');
    setResetPwdError('');
  };

  const validateUserForm = () => {
    const nextErrors: FormErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'Ad zorunludur.';
    if (!form.lastName.trim()) nextErrors.lastName = 'Soyad zorunludur.';
    if (!form.email.trim()) nextErrors.email = 'E-posta zorunludur.';
    if (!form.roleId) nextErrors.roleId = 'Rol zorunludur.';
    if (modal === 'add' && !form.password.trim()) nextErrors.password = 'Şifre zorunludur.';
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validateUserForm()) {
      setFormError('Lütfen zorunlu alanları doldurun.');
      return;
    }
    setSaving(true);
    setFormError('');
    setFormErrors({});
    try {
      if (modal === 'add') {
        const dupEmail = users.find((u) => u.email.toLowerCase() === form.email.toLowerCase());
        if (dupEmail) {
          setFormError('Bu e-posta adresiyle kayıtlı bir kullanıcı zaten mevcut!');
          setSaving(false);
          return;
        }
        await axios.post(
          `${API}/users`,
          {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone || undefined,
            password: form.password,
            roleId: form.roleId,
          },
          { headers: authHeader() },
        );
      } else if (modal === 'edit' && editingUser) {
        const payload: any = {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          roleId: form.roleId,
        };
        if (form.password) payload.password = form.password;
        await axios.patch(`${API}/users/${editingUser.id}`, payload, {
          headers: authHeader(),
        });
      }
      closeModal();
      await loadUsers();
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          'Bir hata oluştu.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (u: User) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    if (newStatus === 'inactive') {
      const confirmed = window.confirm(
        `Bu kullanıcıyı pasife almak istediğinize emin misiniz?\n\n${u.firstName} ${u.lastName} (${u.email})`,
      );
      if (!confirmed) return;
    }
    try {
      await axios.patch(
        `${API}/users/${u.id}`,
        { status: newStatus },
        { headers: authHeader() },
      );
      await loadUsers();
    } catch {}
  };

  const handleBulkStatus = async (newStatus: 'active' | 'inactive') => {
    for (const id of Array.from(selected)) {
      try {
        await axios.patch(
          `${API}/users/${id}`,
          { status: newStatus },
          { headers: authHeader() },
        );
      } catch {}
    }
    setSelected(new Set());
    await loadUsers();
  };

  const handleResetPassword = async () => {
    if (!editingUser || !resetPwd) {
      setResetPwdError('Yeni şifre zorunludur.');
      return;
    }
    if (resetPwd.length < 6) {
      setResetPwdError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    setSaving(true);
    setResetPwdError('');
    try {
      await axios.patch(
        `${API}/users/${editingUser.id}`,
        { password: resetPwd },
        { headers: authHeader() },
      );
      closeModal();
    } catch (err: any) {
      setResetPwdError(err.response?.data?.message || 'Şifre sıfırlama başarısız.');
    } finally {
      setSaving(false);
    }
  };

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Kullanıcı Yönetimi</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Sistem kullanıcılarını görüntüleyin ve yönetin.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Kullanıcı
        </button>
      </div>

      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad, e-posta veya rol ara..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
          >
            <option value="">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
          <select
            value={filterRoleId}
            onChange={(e) => setFilterRoleId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
          >
            <option value="">Tüm Roller</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Toplu işlem toolbar */}
        {selected.size > 0 && (
          <div className="mt-3 flex items-center gap-3 pt-3 border-t border-slate-100">
            <span className="text-sm text-slate-600 font-medium">{selected.size} kullanıcı seçildi</span>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-60"
            >
              {bulkDeleting ? 'Siliniyor...' : 'Seçilenleri Sil'}
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus('active')}
              className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
            >
              Aktif Yap
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus('inactive')}
              className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"
            >
              Pasif Yap
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-slate-400 hover:text-slate-600 ml-auto"
            >
              Seçimi Temizle
            </button>
          </div>
        )}
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">
            <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            {search || filterStatus || filterRoleId
              ? 'Filtrelere uyan kullanıcı bulunamadı.'
              : 'Henüz kullanıcı yok.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left">
                    <button
                      type="button"
                      onClick={selectAll}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        selected.size === filtered.length && filtered.length > 0
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {selected.size === filtered.length && filtered.length > 0 && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Ad Soyad
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    E-posta
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Son Giriş
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-slate-50 transition-colors ${selected.has(u.id) ? 'bg-blue-50/50' : ''} ${u.status !== 'active' ? 'opacity-60' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      {u.email === PROTECTED_ADMIN_EMAIL || u.id === currentUserId ? (
                        <span
                          className="inline-flex h-4 w-4 rounded border-2 border-slate-200 bg-slate-100"
                          title={u.id === currentUserId ? 'Kendi hesabınızı seçemezsiniz' : 'Sistem yöneticisi seçilemez'}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSelect(u.id)}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                            selected.has(u.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 hover:border-blue-400'
                          }`}
                        >
                          {selected.has(u.id) && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      )}
                    </td>

                    {/* Ad Soyad */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {u.firstName} {u.lastName}
                          </p>
                          {u.phone && (
                            <p className="text-xs text-slate-400">{u.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* E-posta */}
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>

                    {/* Rol */}
                    <td className="px-4 py-3">
                      {u.role ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {u.role.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Durum */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeCls(u.status)}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`}
                        />
                        {statusLabel(u.status)}
                      </span>
                    </td>

                    {/* Son Giriş */}
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(u.lastLoginAt)}</td>

                    {/* İşlemler */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Düzenle */}
                        {u.email === PROTECTED_ADMIN_EMAIL ? (
                          <div className="relative group">
                            <button
                              type="button"
                              disabled
                              title="Sistem yöneticisi düzenlenemez"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-200 cursor-not-allowed"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-10">
                              <div className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                Sistem yöneticisi düzenlenemez
                                <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-800" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            title="Düzenle"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}

                        {/* Şifre Sıfırla */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser(u);
                            setResetPwd('');
                            setResetPwdError('');
                            setModal('resetPwd');
                          }}
                          title="Şifre Sıfırla"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>

                        {/* Aktif/Pasif Toggle */}
                        {u.email === PROTECTED_ADMIN_EMAIL ? (
                          <div className="relative group">
                            <button
                              type="button"
                              disabled
                              className="relative inline-flex items-center h-5 w-9 shrink-0 rounded-full cursor-not-allowed opacity-40 bg-green-500"
                            >
                              <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 translate-x-4" />
                            </button>
                            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-10">
                              <div className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                Sistem yöneticisi düzenlenemez
                                <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-800" />
                              </div>
                            </div>
                          </div>
                        ) : u.id === currentUserId ? (
                          <div
                            title="Kendi hesabınızı pasife alamazsınız"
                            className="relative group"
                          >
                            <button
                              type="button"
                              disabled
                              className={`relative inline-flex items-center h-5 w-9 shrink-0 rounded-full cursor-not-allowed opacity-40 ${
                                u.status === 'active' ? 'bg-green-500' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                  u.status === 'active' ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-10">
                              <div className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                Kendi hesabınızı pasife alamazsınız
                                <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-800" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            title={u.status === 'active' ? 'Pasif Yap' : 'Aktif Yap'}
                            className={`relative inline-flex items-center h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${
                              u.status === 'active' ? 'bg-green-500' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                u.status === 'active' ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Alt bilgi */}
        {!loading && (
          <div className="px-4 py-3 border-t border-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {filtered.length} kullanıcı gösteriliyor
              {(search || filterStatus || filterRoleId) && ` (${users.length} toplam)`}
            </p>
          </div>
        )}
      </div>

      {/* ── Yeni Kullanıcı / Düzenle Modal ────────────────────────────────── */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal
          title={modal === 'add' ? 'Yeni Kullanıcı Ekle' : 'Kullanıcıyı Düzenle'}
          onClose={closeModal}
        >
          <div className="space-y-4">
            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ad" required error={formErrors.firstName}>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => {
                    setForm({ ...form, firstName: e.target.value });
                    setFormErrors((prev) => ({ ...prev, firstName: undefined, general: undefined }));
                  }}
                  onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, firstName: v })); }}
                  className={inputCls}
                  placeholder="Ad"
                />
              </FormField>
              <FormField label="Soyad" required error={formErrors.lastName}>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => {
                    setForm({ ...form, lastName: e.target.value });
                    setFormErrors((prev) => ({ ...prev, lastName: undefined, general: undefined }));
                  }}
                  onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, lastName: v })); }}
                  className={inputCls}
                  placeholder="Soyad"
                />
              </FormField>
            </div>

            <FormField label="E-posta" required error={formErrors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setFormErrors((prev) => ({ ...prev, email: undefined, general: undefined }));
                }}
                className={inputCls}
                placeholder="ornek@sirket.com"
                disabled={false}
                readOnly={false}
              />
            </FormField>

            <FormField label="Telefon">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputCls}
                placeholder="+90 555 000 00 00"
              />
            </FormField>

            <FormField
              label={modal === 'add' ? 'Şifre' : 'Yeni Şifre (isteğe bağlı)'}
              required={modal === 'add'}
              error={formErrors.password}
            >
              <input
                type="password"
                value={form.password}
                onChange={(e) => {
                  setForm({ ...form, password: e.target.value });
                  setFormErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
                }}
                className={inputCls}
                placeholder={modal === 'add' ? 'En az 6 karakter' : 'Boş bırakırsanız değişmez'}
              />
            </FormField>

            <FormField label="Rol" required error={formErrors.roleId}>
              <select
                value={form.roleId}
                onChange={(e) => {
                  setForm({ ...form, roleId: e.target.value });
                  setFormErrors((prev) => ({ ...prev, roleId: undefined, general: undefined }));
                }}
                className={inputCls}
              >
                <option value="">Rol Seçin...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Kaydediliyor...' : modal === 'add' ? 'Kullanıcı Oluştur' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Şifre Sıfırlama Modal ──────────────────────────────────────────── */}
      {modal === 'resetPwd' && editingUser && (
        <Modal
          title={`Şifre Sıfırla — ${editingUser.firstName} ${editingUser.lastName}`}
          onClose={closeModal}
        >
          <div className="space-y-4">
            {resetPwdError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {resetPwdError}
              </div>
            )}
            <p className="text-sm text-slate-500">
              Bu kullanıcı için yeni bir şifre belirleyin. Kullanıcı bir sonraki girişinde bu şifreyi kullanacaktır.
            </p>
            <FormField label="Yeni Şifre" required>
              <input
                type="password"
                value={resetPwd}
                onChange={(e) => setResetPwd(e.target.value)}
                className={inputCls}
                placeholder="En az 6 karakter"
                autoFocus
              />
            </FormField>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={saving || !resetPwd}
                className="flex-1 py-2.5 bg-yellow-500 text-white rounded-xl text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Sıfırlanıyor...' : 'Şifreyi Sıfırla'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
