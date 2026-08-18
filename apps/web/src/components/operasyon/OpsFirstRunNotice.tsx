'use client';

import { useEffect, useState } from 'react';
import { dismissOpsNotice, isOpsNoticeDismissed } from '@/utils/ops-first-run-notice';

type Props = {
  noticeId: string;
  title: string;
  body: string;
  testId: string;
  className?: string;
};

/** İş ekranında bir kez. Anladım deyince kaybolur. Yeni menü / eğitim sayfası değildir. */
export function OpsFirstRunNotice({ noticeId, title, body, testId, className = '' }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isOpsNoticeDismissed(noticeId));
  }, [noticeId]);

  if (!visible) return null;

  return (
    <div
      className={`rounded-xl border border-brand-600/25 bg-brand-50 px-3 py-2.5 ${className}`.trim()}
      role="status"
      data-testid={testId}
    >
      <p className="text-sm font-semibold text-content-primary">{title}</p>
      <p className="mt-1 text-xs leading-snug text-content-secondary">{body}</p>
      <button
        type="button"
        className="mt-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        data-testid={`${testId}-anladim`}
        onClick={() => {
          dismissOpsNotice(noticeId);
          setVisible(false);
        }}
      >
        Anladım
      </button>
    </div>
  );
}
