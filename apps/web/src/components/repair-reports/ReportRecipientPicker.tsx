'use client';

import { useId, useMemo, useState } from 'react';

export type MailContact = {
  id: string;
  name: string;
  role: string;
  email: string;
};
export type MailRecipient = MailContact & { delivery: 'to' | 'cc' | 'bcc' };

const keyOf = (email: string) => email.trim().toLowerCase();
const validEmail = (email: string) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email);

/** Controlled selection: the parent owns the draft and submits it to the real API. */
export function ReportRecipientPicker({
  contacts,
  value,
  onChange,
  disabled = false,
  allowManual = false,
}: {
  contacts: MailContact[];
  value: MailRecipient[];
  onChange: (recipients: MailRecipient[]) => void;
  disabled?: boolean;
  /** Enable only when the existing authorization and server policy allow it. */
  allowManual?: boolean;
}) {
  const prefix = useId();
  const [extra, setExtra] = useState<MailContact[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState('');
  const rows = useMemo(() => {
    const unique = new Map<string, MailContact>();
    for (const row of [...contacts, ...extra, ...value]) {
      const email = row.email.trim();
      if (validEmail(email) && !unique.has(keyOf(email))) unique.set(keyOf(email), { ...row, email });
    }
    return [...unique.values()];
  }, [contacts, extra, value]);
  const selected = new Map(value.map(row => [keyOf(row.email), row]));
  const toCount = value.filter(row => row.delivery === 'to').length;
  const ccCount = value.filter(row => row.delivery === 'cc').length;
  const bccCount = value.filter(row => row.delivery === 'bcc').length;
  const fieldClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60';

  function addRecipient() {
    if (disabled || !allowManual) return;
    const email = emailInput.trim();
    if (!validEmail(email)) { setError('Geçerli bir e-posta adresi girin.'); return; }
    if (rows.some(row => keyOf(row.email) === keyOf(email))) {
      setError('Bu adres listede zaten var; ilgili satırdan seçebilirsiniz.'); return;
    }
    const row = { id: `manual:${keyOf(email)}`, name: 'Ek alıcı', role: 'Elle eklenen', email };
    setExtra(prev => [...prev, row]);
    onChange([...value, { ...row, delivery: 'to' }]);
    setEmailInput(''); setError('');
  }

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-semibold text-slate-900">Alıcılar</legend>
      <p className="mt-1 text-xs text-slate-500">Dosyadaki birden fazla muhatabı seçebilirsiniz.</p>
      {rows.length === 0 && <p className="py-4 text-sm text-slate-600">Dosyada e-posta adresi bulunan muhatap yok.</p>}
      <div className="mt-2 divide-y divide-slate-200">
        {rows.map((row, index) => {
          const key = keyOf(row.email);
          const current = selected.get(key);
          const id = `${prefix}-${index}`;
          return (
            <div key={key} className="flex items-center gap-3 py-3">
              <input id={id} type="checkbox" checked={Boolean(current)} className="h-5 w-5 shrink-0 accent-blue-600"
                onChange={event => onChange(event.target.checked
                  ? [...value, { ...row, delivery: 'to' }]
                  : value.filter(item => keyOf(item.email) !== key))} />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-medium text-slate-900">{row.name} <span className="text-xs font-normal text-slate-500">· {row.role}</span></span>
                <span className="block break-all text-xs text-slate-600">{row.email}</span>
              </label>
              <select aria-label={`${row.name} için alıcı türü`} disabled={disabled || !current}
                value={current?.delivery ?? 'to'} className={`${fieldClass} w-28 shrink-0`}
                onChange={event => {
                  const raw = event.target.value;
                  const delivery = raw === 'cc' ? 'cc' : raw === 'bcc' ? 'bcc' : 'to';
                  onChange(value.map(item => keyOf(item.email) === key ? { ...item, delivery } : item));
                }}>
                <option value="to">Kime</option>
                <option value="cc">Bilgi</option>
                <option value="bcc">Gizli</option>
              </select>
            </div>
          );
        })}
      </div>
      {allowManual ? (
        <div className="mt-3" data-testid="onaya-gonder-ek-alici">
          <p className="mb-1.5 text-xs font-medium text-slate-600">Ek satır — başka e-posta</p>
          <label htmlFor={`${prefix}-extra`} className="sr-only">Başka e-posta adresi</label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`${prefix}-extra`}
              type="email"
              value={emailInput}
              placeholder="ornek@firma.com"
              aria-describedby={error ? `${prefix}-error` : undefined}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setEmailInput(event.target.value);
                setError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addRecipient();
                }
              }}
              className={`${fieldClass} min-w-0 flex-1`}
            />
            <button type="button" onClick={addRecipient} className={`${fieldClass} font-medium`}>
              Satır Ekle
            </button>
          </div>
          {error ? (
            <p id={`${prefix}-error`} role="alert" className="mt-1 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      <p aria-live="polite" className="mt-3 text-xs text-slate-600">
        {value.length} alıcı seçildi · {toCount} Kime · {ccCount} Bilgi · {bccCount} Gizli
      </p>
    </fieldset>
  );
}

/** Client-side convenience only. Repeat validation and authorization on the server. */
export function buildRecipientPayload(recipients: MailRecipient[]) {
  if (!recipients.length) throw new Error('En az bir alıcı seçin.');
  const seen = new Set<string>();
  for (const recipient of recipients) {
    const key = keyOf(recipient.email);
    if (!validEmail(recipient.email.trim())) throw new Error('Geçersiz e-posta adresi.');
    if (recipient.delivery !== 'to' && recipient.delivery !== 'cc' && recipient.delivery !== 'bcc') {
      throw new Error('Geçersiz alıcı türü.');
    }
    if (seen.has(key)) throw new Error('Aynı adres birden fazla kez seçilemez.');
    seen.add(key);
  }
  const to = recipients.filter(row => row.delivery === 'to').map(row => row.email.trim());
  const cc = recipients.filter(row => row.delivery === 'cc').map(row => row.email.trim());
  const bcc = recipients.filter(row => row.delivery === 'bcc').map(row => row.email.trim());
  if (!to.length) throw new Error('En az bir Kime alıcısı seçin.');
  return { to, cc, bcc };
}
