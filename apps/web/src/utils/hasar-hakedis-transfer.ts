import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { toTitleCaseTR } from '@/utils/text-helpers';

export async function transferQuotesToVendorHakedis(params: {
  claimId: string;
  reportId: string;
  quotes: Record<string, number>;
  workGroupName: (workGroupId: string) => string;
}): Promise<void> {
  const entries = Object.entries(params.quotes).filter(([, amount]) => Number(amount) > 0);
  if (entries.length === 0) {
    throw new Error('Aktarılacak tedarikçi teklifi bulunamadı.');
  }

  const flagsRes = await axios.get(`${API}/claim-operation-center/${params.claimId}`, {
    headers: authHeader(),
  });
  const flags = flagsRes.data?.data?.flowFlags ?? flagsRes.data?.flowFlags;
  if (flags && flags.repairPhotosReady === false) {
    throw new Error('Her tedarikçinin onarım bitiş resmi yok. Hakediş açılamaz.');
  }

  const [ctxRes, verRes] = await Promise.all([
    axios.get(`${API}/claim-files/${params.claimId}/budget-supplier-context`, { headers: authHeader() }),
    axios.get(`${API}/claim-files/${params.claimId}/budget-versions/for-repair-report/${params.reportId}`, {
      headers: authHeader(),
    }),
  ]);
  const suppliers = (ctxRes.data?.data?.suppliers ?? ctxRes.data?.suppliers ?? []) as Array<{
    id: string;
    name: string;
    paymentDueDays?: number | null;
  }>;
  const vendor = suppliers[0];
  if (!vendor?.id) {
    throw new Error('Önce dosyaya tedarikçi atayın.');
  }
  if (vendor.paymentDueDays !== 15 && vendor.paymentDueDays !== 30) {
    throw new Error(
      `${vendor.name} kartında hakediş ödeme vadesi (15 veya 30 gün) seçili değil. Önce tedarikçi kartını güncelleyin.`,
    );
  }

  let version = verRes.data?.data ?? verRes.data;
  if (!version?.id) {
    throw new Error('Dosya bütçesi hazırlanamadı.');
  }

  if (!['draft', 'revision'].includes(String(version.status))) {
    const created = await axios.post(
      `${API}/claim-files/${params.claimId}/budget-versions`,
      {
        notes: `repairReportId:${params.reportId}`,
        copyFromVersionId: version.id,
      },
      { headers: authHeader() },
    );
    version = created.data?.data ?? created.data;
  }

  if (!version?.id || !['draft', 'revision'].includes(String(version.status))) {
    throw new Error('Bütçe düzenlenebilir durumda değil.');
  }

  const existingItems = (version.items ?? []) as Array<{
    id: string;
    vendorId?: string | null;
    category?: string | null;
  }>;

  for (const [workGroupId, amount] of entries) {
    const wgName = params.workGroupName(workGroupId) || 'İş Grubu';
    const description = toTitleCaseTR(`Pazarlık Onayı — ${wgName}`);
    const match = existingItems.find(
      (it) => it.vendorId === vendor.id && String(it.category || '').toLowerCase() === wgName.toLowerCase(),
    );
    if (match?.id) {
      await axios.patch(
        `${API}/budget-items/${match.id}`,
        {
          vendorId: vendor.id,
          category: wgName,
          description,
          quantity: 1,
          unitPrice: amount,
          vatRate: 0,
          unit: 'Kalem',
        },
        { headers: authHeader() },
      );
    } else {
      const added = await axios.post(
        `${API}/budget-versions/${version.id}/items`,
        {
          vendorId: vendor.id,
          category: wgName,
          workGroupName: wgName,
          description,
          quantity: 1,
          unitPrice: amount,
          vatRate: 0,
          unit: 'Kalem',
        },
        { headers: authHeader() },
      );
      const item = added.data?.data ?? added.data;
      if (item?.id) existingItems.push({ id: item.id, vendorId: vendor.id, category: wgName });
    }
  }

  await axios.post(`${API}/budget-versions/${version.id}/submit`, {}, { headers: authHeader() });
}
