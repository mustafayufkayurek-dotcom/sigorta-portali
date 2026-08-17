'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** Rota değişiminde üst kenar — yalnızca ince çubuk, metin yok */
export function TopProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      setVisible(true);
      setProgress(30);
      const t1 = setTimeout(() => setProgress(70), 100);
      const t2 = setTimeout(() => setProgress(100), 300);
      const t3 = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 700);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
    return undefined;
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-hidden="true"
      className="fixed top-0 left-0 z-[9999] h-[2px] bg-brand-600 transition-all duration-300 ease-out dark:bg-blue-500"
      style={{ width: `${progress}%` }}
    />
  );
}

export default TopProgressBar;
