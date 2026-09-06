'use client';

import type { LucideIcon } from 'lucide-react';
import { HintIcon } from '@/components/ui/HintIcon';

export function MgmtEmpty({
  icon: Icon,
  title,
  description,
  tall,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tall?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-3 text-center ${
        tall ? 'min-h-[360px]' : 'h-full min-h-[200px]'
      }`}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-2 inline-flex items-center justify-center gap-1.5 text-[13px] font-medium text-slate-700">
        {title}
        <HintIcon text={description} />
      </p>
    </div>
  );
}
