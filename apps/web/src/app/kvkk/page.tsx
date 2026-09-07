import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { KVKK_AYDINLATMA_SECTIONS } from '@/lib/legal-documents';

export const metadata = { title: 'KVKK Aydınlatma Metni' };

export default function KvkkPage() {
  return <LegalDocumentPage title="KVKK Aydınlatma Metni" sections={KVKK_AYDINLATMA_SECTIONS} />;
}
