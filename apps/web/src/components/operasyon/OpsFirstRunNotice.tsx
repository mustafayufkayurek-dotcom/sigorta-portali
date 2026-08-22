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
      className={`rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4 ${className}`.trim()}
      role="status"
      data-testid={testId}
    >
      <p className="text-sm font-medium text-blue-900">{title}</p>
      <p className="mt-1 text-xs leading-snug text-blue-700/80">{body}</p>
      <button
        type="button"
        className="mt-2.5 inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50"
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
