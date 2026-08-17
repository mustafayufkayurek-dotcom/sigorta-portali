import { redirect } from 'next/navigation';

/** Eski kurtarma adayı rotası — tek sahip ekran /panel/kullanicilar */
export default function KullanicilarKurtarmaAdayiPage() {
  redirect('/panel/kullanicilar');
}
