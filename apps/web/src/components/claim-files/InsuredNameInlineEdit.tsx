'use client';

import { useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { toTitleCaseTR } from '@/utils/text-helpers';

export function InsuredNameInlineEdit({
  claimId,
  displayName,
  onSaved,
  compact = false,
}: {
  claimId: string;
  displayName: string;
  onSaved: (insuredName: string) => void;
  compact?: boolean;
}) {
  const missing = displayName === '—';
  const [editing, setEditing] = useState(missing);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const name = toTitleCaseTR(value.trim());
    if (!name) {
      setError('Ad soyad girin');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await axios.patch(`${API}/claim-files/${claimId}`, { insuredName: name }, { headers: authHeader() });
      onSaved(name);
      setEditing(false);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message ?? e.message
        : 'Kaydedilemedi';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSaving(false);
    }
  };

  if (!editing && !missing) {
    return (
      <button
        type="button"
        className="text-left truncate max-w-full hover:text-blue-700"
        title={`${displayName} — düzenlemek için tıklayın`}
        onClick={(e) => {
          e.stopPropagation();
          setValue(displayName);
          setEditing(true);
        }}
      >
        {displayName}
      </button>
    );
  }

  if (!editing && missing) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        Ad Soyad Ekle
      </button>
    );
  }

  return (
    <div
      className={`flex flex-col gap-1 ${compact ? 'min-w-[140px]' : 'min-w-[160px]'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Sigortalı adı soyadı"
          className="flex-1 min-w-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') {
              setEditing(missing);
              setError('');
            }
          }}
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
        >
          {saving ? '…' : 'Kaydet'}
        </button>
      </div>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
