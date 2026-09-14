'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import {
  emptyAcilReportPhraseStore,
  matchAcilReportPhrases,
  rememberAcilReportPhrase,
  type AcilReportPhraseField,
  type AcilReportPhraseStore,
} from '@sigorta/shared';

const STORAGE_KEY = 'acil-rapor-cumle-hafiza-v1';

function readStore(): AcilReportPhraseStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyAcilReportPhraseStore();
    const parsed = JSON.parse(raw) as Partial<AcilReportPhraseStore>;
    return {
      mahal: Array.isArray(parsed.mahal) ? parsed.mahal.filter((x) => typeof x === 'string') : [],
      jobDescription: Array.isArray(parsed.jobDescription)
        ? parsed.jobDescription.filter((x) => typeof x === 'string')
        : [],
      itemDescription: Array.isArray(parsed.itemDescription)
        ? parsed.itemDescription.filter((x) => typeof x === 'string')
        : [],
    };
  } catch {
    return emptyAcilReportPhraseStore();
  }
}

function writeStore(store: AcilReportPhraseStore) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* kota */
  }
}

export function AcilReportPhraseInput({
  field,
  value,
  onChange,
  onCommit,
  placeholder,
  testId,
}: {
  field: AcilReportPhraseField;
  value: string;
  onChange: (v: string) => void;
  onCommit?: (v: string) => void;
  placeholder: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [localPhrases, setLocalPhrases] = useState<string[]>([]);
  const [serverPhrases, setServerPhrases] = useState<string[]>([]);

  useEffect(() => {
    setLocalPhrases(readStore()[field]);
  }, [field]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void axios
        .get(`${API}/emergency/cases/report-line-phrases`, {
          headers: authHeader(),
          params: { field, q: value },
        })
        .then((res) => {
          const rows = (res.data?.data ?? res.data ?? []) as string[];
          setServerPhrases(Array.isArray(rows) ? rows.filter((x) => typeof x === 'string') : []);
        })
        .catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [field, value]);

  const matches = useMemo(
    () => matchAcilReportPhrases(value, [...localPhrases, ...serverPhrases], 8),
    [value, localPhrases, serverPhrases],
  );

  function commit(next = value) {
    const nextStore = rememberAcilReportPhrase(readStore(), field, next);
    writeStore(nextStore);
    setLocalPhrases(nextStore[field]);
    onCommit?.(next);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        data-testid={testId}
        autoComplete="off"
        className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
          commit();
        }}
      />
      {open && matches.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matches.map((phrase) => (
            <li key={phrase}>
              <button
                type="button"
                className="w-full px-2.5 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(phrase);
                  commit(phrase);
                  setOpen(false);
                }}
              >
                {phrase}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
