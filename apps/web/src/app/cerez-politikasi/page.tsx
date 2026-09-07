import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { CEREZ_SECTIONS } from '@/lib/legal-documents';

export const metadata = { title: 'Çerez Politikası' };

export default function CerezPolitikasiPage() {
  return <LegalDocumentPage title="Çerez Politikası" sections={CEREZ_SECTIONS} />;
}
