'use client';
import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

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
      const t3 = setTimeout(() => { setVisible(false); setProgress(0); }, 500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    return undefined;
  }, [pathname]);

  if (!visible) return null;
  return <div className="fixed top-0 left-0 h-[3px] bg-blue-500 z-[9999] transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />;
}

export default TopProgressBar;
