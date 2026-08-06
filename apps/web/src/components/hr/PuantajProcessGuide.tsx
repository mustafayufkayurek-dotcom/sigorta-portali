'use client';

type Props = {
  /** Kısa süreç notu — yönlendirme butonu yok (kuşbaşı denetim ana ekranda) */
  compact?: boolean;
};

const PROCESS_STEPS = [
  'Personel Devam sekmesinde günlük Onayla ile teyit verir',
  'Ay sonunda Aylık Onay ile dönemi onaya gönderir',
  'Admin veya Finans Onayla Ve Kilitle uygular (biri yeterli; çift onay aranmaz)',
  'Mali Müşavir Çıktısı ile Excel / yazdır / e-posta gönderilir',
];

/**
 * Finans / yönetici için kısa süreç özeti.
 * "Sekmeye Git" CTA yok — admin kuşbaşı denetimde kalır.
 */
export function PuantajProcessGuide({ compact = false }: Props) {
  if (compact) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-content-secondary">
        Personel günlük ve aylık onay verir;{' '}
        <span className="font-semibold text-content-primary">Onayla Ve Kilitle</span>
        {' '}Admin veya Finans’tan biri yeterlidir.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-content-primary">Devam Süreç Özeti</p>
        <p className="text-xs text-content-secondary mt-1">
          Personel onaya gönderir; Admin veya Finans’tan biri onaylayınca süreç tamamlanır.
        </p>
      </div>
      <ol className="text-xs text-content-secondary space-y-1 list-decimal list-inside">
        {PROCESS_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
