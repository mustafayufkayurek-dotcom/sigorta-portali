"use client";

import Link from "next/link";

export default function AyarlarPage() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Ayarlar</h1>
      <p className="text-sm text-muted-foreground">
        Bu sayfa placeholder olarak eklendi. Alt ayar modüllerinden birini seçin.
      </p>
      <div className="flex flex-col gap-2">
        <Link className="text-primary underline" href="/panel/ayarlar/kurulum">
          Kurulum
        </Link>
        <Link className="text-primary underline" href="/panel/ayarlar/roller">
          Roller
        </Link>
        <Link className="text-primary underline" href="/panel/ayarlar/tanimlar">
          Tanımlar
        </Link>
      </div>
    </div>
  );
}