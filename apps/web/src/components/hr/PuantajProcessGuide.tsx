'use client';

type Props = {
  onGoToAttendance: () => void;
};

const PROCESS_STEPS = [
  'Personel Puantaj sekmesinde günlük Onayla ile teyit verir',
  'Ay sonunda Aylık Onay ile dönemi onaya gönderir',
  'Admin veya Finans Onayla Ve Kilitle uygular (biri yeterli; çift onay aranmaz)',
  'Mali Müşavir Çıktısı ile Excel / yazdır / e-posta gönderilir',
];

export function PuantajProcessGuide({ onGoToAttendance }: Props) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-content-primary">Puantaj Süreç Yönetimi</p>
        <p className="text-xs text-content-secondary mt-1">
          Personel onaya gönderir; Admin veya Finans’tan biri onaylayınca süreç tamamlanır.
        </p>
      </div>
      <ol className="text-xs text-content-secondary space-y-1 list-decimal list-inside">
        {PROCESS_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onGoToAttendance}
        className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5"
      >
        Puantaj Sekmesine Git
      </button>
    </div>
  );
}
