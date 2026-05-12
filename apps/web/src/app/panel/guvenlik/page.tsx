"use client";

import Link from "next/link";

export default function GuvenlikPage() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Güvenlik</h1>
      <p className="text-sm text-muted-foreground">
        Bu sayfa placeholder olarak eklendi. Güvenlik modüllerinden birini seçin.
      </p>
      <div className="flex flex-col gap-2">
        <Link className="text-primary underline" href="/panel/guvenlik/erisim-loglari">
          Erişim Logları
        </Link>
      </div>
    </div>
  );
}