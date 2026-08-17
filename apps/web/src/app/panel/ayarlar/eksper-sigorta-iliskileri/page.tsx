'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, formatSettingsApiError, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';

type ExpertRow = { id: string; name: string };
type InsuranceRow = { id: string; name: string };

function linkKey(expertId: string, insuranceId: string) {
  return `${expertId}::${insuranceId}`;
}

export default function EksperSigortaIliskileriPage() {
  const [experts, setExperts] = useState<ExpertRow[]>([]);
  const [insurers, setInsurers] = useState<InsuranceRow[]>([]);
  const [links, setLinks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [customersRes, insurersRes, linksRes] = await Promise.all([
        axios.get(`${API}/customers`, {
          headers: authHeader(),
          params: { limit: 500, status: 'active', customerType: 'corporate', subType: 'eksper_firmasi' },
        }),
        axios.get(`${API}/insurance-companies`, {
          headers: authHeader(),
          params: { limit: 500, status: 'active' },
        }),
        axios.get(`${API}/system-settings/eksper-sigorta-baglantilari`, { headers: authHeader() }),
      ]);
      const customerList = customersRes.data?.data ?? customersRes.data ?? [];
      setExperts(
        (Array.isArray(customerList) ? customerList : [])
          .map((c: { id: string; companyName?: string; fullName?: string }) => ({
            id: c.id,
            name: (c.companyName ?? c.fullName ?? '').trim(),
          }))
          .filter((c: ExpertRow) => c.name)
          .sort((a: ExpertRow, b: ExpertRow) => a.name.localeCompare(b.name, 'tr')),
      );
      const insurerList = insurersRes.data?.data ?? insurersRes.data ?? [];
      setInsurers(
        (Array.isArray(insurerList) ? insurerList : [])
          .map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
      );
      const rawLinks = linksRes.data?.data?.links ?? [];
      setLinks(
        new Set(
          (Array.isArray(rawLinks) ? rawLinks : []).map((l: { expertCustomerId: string; insuranceCompanyId: string }) =>
            linkKey(l.expertCustomerId, l.insuranceCompanyId),
          ),
        ),
      );
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (expertId: string, insuranceId: string) => {
    setSaved(false);
    const key = linkKey(expertId, insuranceId);
    setLinks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const payload = {
        links: [...links].map((key) => {
          const [expertCustomerId, insuranceCompanyId] = key.split('::');
          return { expertCustomerId, insuranceCompanyId };
        }),
      };
      await axios.put(`${API}/system-settings/eksper-sigorta-baglantilari`, payload, { headers: authHeader() });
      setSaved(true);
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const expertsWithoutLinks = useMemo(
    () => experts.filter((e) => !insurers.some((i) => links.has(linkKey(e.id, i.id)))),
    [experts, insurers, links],
  );

  return (
    <SettingsPageLayout
      title="Eksper–Sigorta İlişkileri"
      description="Hangi eksper firmasının hangi sigorta şirketinden dosya gönderdiğini tanımlayın. Hasar raporları ve davet kapsamı bu matrise dayanır."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {saved && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">İlişkiler kaydedildi.</p>}
        {expertsWithoutLinks.length > 0 && !loading && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {expertsWithoutLinks.length} eksper firmasının henüz sigorta bağlantısı yok:{' '}
            {expertsWithoutLinks.map((e) => e.name).join(', ')}
          </p>
        )}
        {loading ? (
          <p className="text-sm text-slate-500">Yükleniyor...</p>
        ) : experts.length === 0 || insurers.length === 0 ? (
          <p className="text-sm text-slate-500">
            Matris için en az bir eksper firması (Müşteriler) ve bir sigorta şirketi kaydı gerekir.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-center font-medium text-slate-600">
                    Eksper Firması
                  </th>
                  {insurers.map((ins) => (
                    <th key={ins.id} className="px-3 py-3 text-center font-medium text-slate-600 min-w-[7rem]">
                      {ins.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {experts.map((expert) => (
                  <tr key={expert.id} className="border-b border-slate-50">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-slate-800 whitespace-nowrap">
                      {expert.name}
                    </td>
                    {insurers.map((ins) => (
                      <td key={ins.id} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          className="rounded accent-brand-600"
                          checked={links.has(linkKey(expert.id, ins.id))}
                          onChange={() => toggle(expert.id, ins.id)}
                          aria-label={`${expert.name} — ${ins.name}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SettingsPageLayout>
  );
}
