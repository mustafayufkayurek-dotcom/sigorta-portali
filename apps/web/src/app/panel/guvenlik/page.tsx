"use client";

import Link from "next/link";

export default function GuvenlikPage() {
  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="page-title">Güvenlik</h1>
          <p className="page-subtitle">
            Güvenlik modüllerinden birini seçin.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Link className="text-sm font-medium text-blue-600 hover:text-blue-700" href="/panel/guvenlik/erisim-loglari">
          Erişim Logları
        </Link>
      </div>
    </div>
  );
}