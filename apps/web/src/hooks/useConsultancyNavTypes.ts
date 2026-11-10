'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import {
  CONSULTANCY_SERVICE_FAMILY,
  isHasarTespitConsultancyType,
  mergeHizmetKartlari,
  parseServiceTypeListPayload,
  type HizmetKarti,
} from '@sigorta/shared';
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
          .filter((r) => r.isActive !== false && !isHasarTespitConsultancyType(r))
          .map((r) => ({ name: r.name, code: String(r.code ?? '').trim() }))
          .filter((r) => r.name);
        if (alive && mapped.length) setTypes(mapped);
      })
      .catch(() => {
        /* menüde Danışmanlık durur */
      });
    return () => {
      alive = false;
    };
  }, []);

  return types;
}

const BUILTIN_MENU = new Set(['hasar-onarim', 'acil', 'hasar-tespit', 'danismanlik', 'police-yonetimi']);

export type HizmetMenuState = {
  cards: HizmetKarti[];
  asistansExtra: { name: string; code: string; steps: string }[];
  ekExtra: { name: string; code: string }[];
  hiddenCodes: string[];
};

const EMPTY_MENU: HizmetMenuState = { cards: [], asistansExtra: [], ekExtra: [], hiddenCodes: [] };

export function useHizmetMenu(): HizmetMenuState {
  const [state, setState] = useState<HizmetMenuState>(EMPTY_MENU);

  useEffect(() => {
    let alive = true;
    axios
      .get(`${API}/system-settings/hizmet-kartlari`, { headers: authHeader() })
      .then((res) => {
        const saved = Array.isArray(res.data?.data) ? res.data.data : [];
        const cards = mergeHizmetKartlari(saved);
        if (!alive) return;
        setState({
          cards,
          asistansExtra: cards
            .filter((card) => card.group === 'asistans' && card.menuVisible !== false && !BUILTIN_MENU.has(card.code))
            .map((card) => ({ name: card.name, code: card.code, steps: card.steps })),
          ekExtra: cards
            .filter((card) => card.group === 'ek' && card.menuVisible !== false && !BUILTIN_MENU.has(card.code))
            .map((card) => ({ name: card.name, code: card.code })),
          hiddenCodes: cards.filter((card) => card.menuVisible === false).map((card) => card.code),
        });
      })
      .catch(() => {
        /* menüde Hasar ve Acil durur */
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export function useHizmetKartlari(): HizmetKarti[] {
  return useHizmetMenu().cards;
}
