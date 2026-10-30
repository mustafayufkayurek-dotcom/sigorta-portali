'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { CONSULTANCY_SERVICE_FAMILY, parseServiceTypeListPayload } from '@sigorta/shared';
import { fallbackConsultancyNavTypes } from '@/utils/operasyon-nav';

export function useConsultancyNavTypes() {
  const [types, setTypes] = useState(fallbackConsultancyNavTypes);

  useEffect(() => {
    let alive = true;
    axios
      .get(`${API}/service-types`, {
        headers: authHeader(),
        params: { family: CONSULTANCY_SERVICE_FAMILY },
      })
      .then((res) => {
        const mapped = parseServiceTypeListPayload(res.data)
          .filter((r) => r.isActive !== false)
          .map((r) => ({ name: r.name, code: String(r.code ?? '').trim() }))
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
