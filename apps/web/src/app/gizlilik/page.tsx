import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { GIZLILIK_SECTIONS } from '@/lib/legal-documents';

export const metadata = { title: 'Gizlilik Politikası' };

export default function GizlilikPage() {
  return <LegalDocumentPage title="Gizlilik Politikası" sections={GIZLILIK_SECTIONS} />;
}
