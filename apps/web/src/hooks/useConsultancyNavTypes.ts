'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { fallbackConsultancyNavTypes } from '@/utils/operasyon-nav';

export function useConsultancyNavTypes() {
  const [types, setTypes] = useState(fallbackConsultancyNavTypes);

  useEffect(() => {
    let alive = true;
    axios
      .get(`${API}/service-types/active`, { headers: authHeader() })
      .then((res) => {
        const rows = (res.data?.data ?? []) as { name?: string; code?: string | null }[];
        const mapped = rows
          .map((r) => ({ name: String(r.name ?? '').trim(), code: String(r.code ?? '').trim() }))
          .filter((r) => r.name);
        if (alive && mapped.length) setTypes(mapped);
      })
      .catch(() => {
        /* menüde Hasar Tespit durur */
      });
    return () => {
      alive = false;
    };
  }, []);

  return types;
}
