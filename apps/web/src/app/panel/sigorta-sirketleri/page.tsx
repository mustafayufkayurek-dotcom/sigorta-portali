import { redirect } from 'next/navigation';

export default function LegacySigortaSirketleriRedirectPage() {
  redirect('/panel/ayarlar/sigorta-sirketleri');
}
