'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  COLLECTION_PARTY,
  canToggleCollectionPartyLock,
  collectionPartyLabel,
  isInsuredCollectionParty,
  parseCollectionParty,
  type CollectionParty,
} from '@sigorta/shared';
import { useToast } from '@/contexts/ToastContext';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';

const REPORT_APPROVED = new Set(['approved', 'externally_approved']);

function currentRoleCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    for (const key of ['user', 'currentUser']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const u = JSON.parse(raw);
      const code = u?.roleCode ?? u?.role?.code;
      if (typeof code === 'string' && code.trim()) return code;
    }
  } catch {
    return null;
  }
  return null;
}

export function HasarCollectionPartyAdminLock({
  claim,
  onUpdated,
}: {
  claim: {
    id: string;
    collectionParty?: string | null;
    collectionPartyLocked?: boolean | null;
    latestRepairReport?: { status?: string | null } | null;
    newestRepairReportStatus?: string | null;
    insuredName?: string | null;
    insuranceCompany?: { name?: string | null } | null;
  };
  onUpdated?: (patch: { collectionParty?: string; collectionPartyLocked?: boolean }) => void;
}) {
  const { showToast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const approved = REPORT_APPROVED.has(
    String(claim.latestRepairReport?.status ?? claim.newestRepairReportStatus ?? '').toLowerCase(),
  );

  useEffect(() => {
    setIsAdmin(canToggleCollectionPartyLock(currentRoleCode()));
  }, []);

  if (!isAdmin || !approved) return null;

  const locked = Boolean(claim.collectionPartyLocked);
  const party = parseCollectionParty(claim.collectionParty) ?? COLLECTION_PARTY.insuranceCompany;
  const insurer = claim.insuranceCompany?.name?.trim() || 'Sigorta Şirketi';
  const insured = claim.insuredName?.trim() || 'Sigortalı';

  const patch = async (body: { collectionParty?: CollectionParty; collectionPartyLocked?: boolean }) => {
    if (saving) return;
    setSaving(true);
    try {
      await axios.patch(`${API}/claim-files/${claim.id}`, body, { headers: authHeader() });
      onUpdated?.({
        ...(body.collectionParty ? { collectionParty: body.collectionParty } : {}),
        collectionPartyLocked: body.collectionParty ? true : Boolean(body.collectionPartyLocked),
      });
      showToast(
        'success',
        body.collectionParty
          ? `${collectionPartyLabel(body.collectionParty)} kaydedildi ve kilitlendi`
          : body.collectionPartyLocked
            ? 'Tahsilat tarafı kilitlendi'
            : 'Tahsilat kilidi açıldı',
      );
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Kilit güncellenemedi'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
      data-testid="hasar-tahsilat-admin-kilit"
    >
      <p className="text-[11px] font-semibold text-slate-700">Tahsilat tarafı kilidi</p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {locked
          ? `${collectionPartyLabel(party)} · kilitli, değişmez`
          : 'Kilit açık. Değiştirince yeniden kilitlenir.'}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {locked ? (
          <button
            type="button"
            disabled={saving}
            data-testid="hasar-tahsilat-kilidi-ac"
            onClick={() => void patch({ collectionPartyLocked: false })}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Kilidi aç
          </button>
        ) : (
          <>
            {([COLLECTION_PARTY.insuranceCompany, COLLECTION_PARTY.insured] as const).map((option) => (
              <button
                key={option}
                type="button"
                disabled={saving}
                data-testid={`hasar-tahsilat-admin-${option}`}
                onClick={() => void patch({ collectionParty: option, collectionPartyLocked: false })}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50 ${
                  party === option
                    ? 'border-brand-600 bg-brand-50 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {isInsuredCollectionParty(option) ? insured : insurer}
              </button>
            ))}
            <button
              type="button"
              disabled={saving}
              data-testid="hasar-tahsilat-kilitle"
              onClick={() => void patch({ collectionPartyLocked: true })}
              className="rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Kilitle
            </button>
          </>
        )}
      </div>
    </div>
  );
}
