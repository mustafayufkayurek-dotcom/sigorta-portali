'use client';

type Props = {
  onGoToAttendance: () => void;
};

const PROCESS_STEPS = [
  'Personel Puantaj sekmesinde günlük Onayla ile teyit verir',
  'Ay sonunda Aylık Onay ile dönemi kapatır',
  'Süreç sorumlusu Ayı Kilitle (İK) uygular',
  'Mali Müşavir Çıktısı ile Excel / yazdır / e-posta gönderilir',
];

export function PuantajProcessGuide({ onGoToAttendance }: Props) {
  return (
    <div className="rounded-xl border border-[#1a4080]/20 bg-[#1a4080]/5 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">Puantaj Süreç Yönetimi</p>
        <p className="text-xs text-slate-600 mt-1">
          Finans süreç sorumlusu işlemleri bu ekrandan yürütür. Mali müşavir çıktısı Puantaj sekmesindedir.
        </p>
      </div>
      <ol className="text-xs text-slate-700 space-y-1 list-decimal list-inside">
        {PROCESS_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onGoToAttendance}
        className="rounded-lg bg-[#1a4080] text-white text-xs font-medium px-3 py-2 hover:bg-[#153366]"
      >
        Puantaj Sekmesine Git
      </button>
    </div>
  );
}
