'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

interface ExchangeRate {
  code: string;
  name: string;
  buyingRate: number;
  sellingRate: number;
  effectiveBuying: number;
  effectiveSelling: number;
}

interface ExchangeRatesData {
  date: string;
  rates: ExchangeRate[];
  usd: ExchangeRate | null;
  eur: ExchangeRate | null;
  gbp: ExchangeRate | null;
}

const MOCK_PREV: Record<string, number> = {
  USD: 32.3,
  EUR: 34.9,
};

function RateChip({ rate, prevRate }: { rate: ExchangeRate | null; prevRate: number }) {
  if (!rate) return null;
  const avg = (rate.buyingRate + rate.sellingRate) / 2;
  const isUp = avg > prevRate;
  const isDown = avg < prevRate;

  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="font-semibold text-gray-500 text-xs">{rate.code}</span>
      <span className="font-bold text-gray-800 tabular-nums">₺{avg > 0 ? avg.toFixed(2) : '—'}</span>
      {isUp && <span className="text-status-danger text-xs font-bold leading-none">↑</span>}
      {isDown && <span className="text-status-success text-xs font-bold leading-none">↓</span>}
      {!isUp && !isDown && <span className="text-gray-400 text-xs leading-none">→</span>}
    </span>
  );
}

export default function ExchangeRatesWidget() {
  const [data, setData] = useState<ExchangeRatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchRates = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await axios.get(`${API}/widgets/exchange-rates`);
        setData(res.data.data as ExchangeRatesData);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchRates();
  }, []);

  return (
    <div className="flex items-center gap-3 h-12 px-3">
      {loading ? (
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-500" />
      ) : error ? (
        <span className="text-xs text-red-400">Kur alınamadı</span>
      ) : data ? (
        <>
          <RateChip rate={data.usd} prevRate={MOCK_PREV['USD']} />
          <span className="text-gray-200 select-none">|</span>
          <RateChip rate={data.eur} prevRate={MOCK_PREV['EUR']} />
        </>
      ) : null}
    </div>
  );
}
