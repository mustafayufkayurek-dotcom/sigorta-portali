'use client';

import { useEffect, useId, useState } from 'react';
import axios from 'axios';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { ADDRESS_FIELD } from '@/constants/address-fields';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

interface NeighborhoodSelectProps {
  provinceName: string;
  districtName: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

export function NeighborhoodSelect({
  provinceName,
  districtName,
  value,
  onChange,
  disabled = false,
  className = '',
  inputClassName = '',
}: NeighborhoodSelectProps) {
  const listId = useId();
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!provinceName.trim() || !districtName.trim()) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${API}/locations/neighborhoods`, {
        params: { provinceName: provinceName.trim(), districtName: districtName.trim() },
      })
      .then((res) => {
        if (cancelled) return;
        const rows: { name: string }[] = res.data?.data ?? [];
        setOptions(rows.map((r) => r.name).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provinceName, districtName]);

  const isDisabled = disabled || !districtName.trim() || loading;

  const placeholder = loading
    ? ADDRESS_FIELD.neighborhoodLoading
    : districtName.trim()
      ? ADDRESS_FIELD.neighborhoodSearch
      : ADDRESS_FIELD.districtPlaceholder;

  return (
    <div className={className}>
      <input
        type="text"
        list={options.length > 0 ? listId : undefined}
        className={inputClassName}
        value={value}
        disabled={isDisabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const trimmed = e.target.value.trim();
          if (!trimmed) return;
          const titled = toTitleCaseTR(trimmed);
          if (titled !== e.target.value) onChange(titled);
        }}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
      {!loading && districtName && options.length === 0 && (
        <p className="text-[11px] text-slate-400 mt-1">
          Liste boş — {ADDRESS_FIELD.neighborhoodPlaceholder} yazarak devam edebilirsiniz.
        </p>
      )}
    </div>
  );
}
