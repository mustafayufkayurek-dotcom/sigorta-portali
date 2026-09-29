import { redirect } from 'next/navigation';

/** Eski mail bağlantısı sayfa açmaz; girişe döner. */
export default function GirisKoduKopyalaPage() {
  redirect('/giris');
}
