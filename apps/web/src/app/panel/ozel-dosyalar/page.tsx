export default function OzelDosyalarPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center">
        <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Özel Dosyalar</h1>
        <p className="text-slate-500 text-sm max-w-md">
          Bu modül yakında kullanıma açılacak. Hasar onarımından farklı akışlara sahip özel dosyaları bu alan üzerinden yönetebileceksiniz.
        </p>
      </div>
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 tracking-wide">
        Yakında
      </span>
    </div>
  );
}
