'use client';

interface FinancePeriodSelectorProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

const MONTHS = [
  { v: 0, l: 'Tüm Yıl' },
  { v: 1, l: 'Ocak' },
  { v: 2, l: 'Şubat' },
  { v: 3, l: 'Mart' },
  { v: 4, l: 'Nisan' },
  { v: 5, l: 'Mayıs' },
  { v: 6, l: 'Haziran' },
  { v: 7, l: 'Temmuz' },
  { v: 8, l: 'Ağustos' },
  { v: 9, l: 'Eylül' },
  { v: 10, l: 'Ekim' },
  { v: 11, l: 'Kasım' },
  { v: 12, l: 'Aralık' },
];

const YEARS = [2024, 2025, 2026];

export function FinancePeriodSelector({
  year,
  month,
  onYearChange,
  onMonthChange,
}: FinancePeriodSelectorProps) {
  const selectClass =
    'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
        className={selectClass}
        aria-label="Yıl seçin"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => onMonthChange(Number(e.target.value))}
        className={selectClass}
        aria-label="Ay seçin"
      >
        {MONTHS.map((m) => (
          <option key={m.v} value={m.v}>
            {m.l}
          </option>
        ))}
      </select>
    </div>
  );
}
