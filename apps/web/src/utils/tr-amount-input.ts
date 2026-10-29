/**
 * Türkiye tutar girişi — binlik ayraç (.) ve ondalık virgül (,).
 */

export function formatTrAmountInput(input: string): string {
  let cleaned = input.replace(/[^\d,]/g, '');
  const commaIdx = cleaned.indexOf(',');
  if (commaIdx !== -1) {
    cleaned =
      cleaned.slice(0, commaIdx + 1) +
      cleaned.slice(commaIdx + 1).replace(/,/g, '');
  }
  const [intRaw, decRaw] = cleaned.split(',');
  const intDigits = (intRaw ?? '').replace(/\D/g, '');
  const formattedInt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decRaw !== undefined) {
    return `${formattedInt},${decRaw.replace(/\D/g, '').slice(0, 2)}`;
  }
  return formattedInt;
}

export function parseTrAmountInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Yazılan tutar: 1.850.000 = bir milyon sekiz yüz elli bin.
 * Hesap: 1,85+2 virgülden sonra noktaya çevrilmiş 1.85 ondalıktır.
 * Tek nokta ve üç hane (15.600) binliktir; bir-iki hane (1.85) ondalıktır.
 */
export function parseTrGroupedOrDecimal(input: string): number | null {
  const t = String(input ?? '').trim().replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',')) return parseTrAmountInput(t);
  const dots = (t.match(/\./g) ?? []).length;
  if (dots >= 2) return parseTrAmountInput(t);
  if (dots === 1) {
    const frac = t.split('.')[1] ?? '';
    if (frac.length === 3 && /^\d+$/.test(frac)) return parseTrAmountInput(t);
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formulaForEval(raw: string): string {
  return raw.replace(/,/g, '.');
}

/** Hücre sayısal girişini normalize eder: 1.850.000 binlik durur; virgül ondalıktır; boş → '0' */
export function normalizeCellNumericInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '0';
  const parsed = parseTrGroupedOrDecimal(trimmed);
  if (parsed == null || !Number.isFinite(parsed)) return '0';
  return String(roundMoney(parsed));
}

export function evaluateAmountExpression(expr: string): number | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;
  if (!/^[\d\s+\-*/.,()]+$/.test(trimmed)) return null;
  if (/[+\-*/]$/.test(trimmed)) return null;
  const hasOperator = /[+*/()]/.test(trimmed) || /\d\s*-\s*\d/.test(trimmed);
  if (!hasOperator) return null;

  try {
    const result = parseExpr(trimmed.replace(/\s+/g, ''));
    if (!Number.isFinite(result)) return null;
    return roundMoney(result);
  } catch {
    return null;
  }
}

function parseExpr(s: string): number {
  let pos = 0;

  function parseNum(): number {
    if (pos >= s.length) throw new Error('Unexpected end');
    if (s[pos] === '(') {
      pos++;
      const val = parseAddSub();
      if (s[pos] !== ')') throw new Error('Missing )');
      pos++;
      return val;
    }
    let numStr = '';
    if (s[pos] === '-') {
      numStr += '-';
      pos++;
    }
    while (pos < s.length && /[\d.,]/.test(s[pos])) {
      numStr += s[pos++];
    }
    if (!numStr || numStr === '-') throw new Error('Invalid number');
    const n = parseTrGroupedOrDecimal(numStr);
    if (n == null) throw new Error('Invalid number');
    return n;
  }

  function parseMulDiv(): number {
    let left = parseNum();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++];
      const right = parseNum();
      if (op === '*') left *= right;
      else {
        if (right === 0) throw new Error('Division by zero');
        left /= right;
      }
    }
    return left;
  }

  function parseAddSub(): number {
    let left = parseMulDiv();
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos++];
      const right = parseMulDiv();
      if (op === '+') left += right;
      else left -= right;
    }
    return left;
  }

  const result = parseAddSub();
  if (pos !== s.length) throw new Error('Unexpected token');
  return result;
}

export function numberToTrAmountInput(n: number | string | null | undefined): string {
  if (n == null || n === '') return '';
  const num = typeof n === 'number' ? n : parseFloat(String(n));
  if (!Number.isFinite(num)) return '';
  const fixed = num.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decPart === '00') return formattedInt;
  return `${formattedInt},${decPart}`;
}
