'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function EksperPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="sticky top-0 z-30 -mx-3 mb-3 flex items-center justify-end border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <Link
          href="/panel/eksper-portal?openIhbar=1"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Yeni İhbar
        </Link>
      </div>
      {children}
    </div>
  );
}
