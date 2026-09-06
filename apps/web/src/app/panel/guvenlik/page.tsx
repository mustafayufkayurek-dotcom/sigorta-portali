"use client";

import Link from "next/link";
import { PageTitleWithHint } from "@/components/ui/HintIcon";

export default function GuvenlikPage() {
  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="page-header">
        <div className="min-w-0">
          <PageTitleWithHint
            title="Güvenlik"
            hint="Erişim kayıtları ve güvenlik kontrolleri."
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Link className="text-sm font-medium text-brand-600 hover:text-blue-700" href="/panel/guvenlik/erisim-loglari">
          Erişim Logları
        </Link>
      </div>
    </div>
  );
}