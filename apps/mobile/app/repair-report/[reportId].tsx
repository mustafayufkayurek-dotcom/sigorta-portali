import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const API = 'http://localhost:3000/api/v1';
const getToken = () => '';
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
}

const DAMAGE_TYPE_CODES = [
  'Dahili Su', 'Yangın', 'Deprem', 'Sel-Seylap', 'Fırtına',
  'Heyelan', 'İnfilak', 'Taşıt Çarpması', 'Gemi-Tekne', 'İnşaat', 'Cam Kırılması',
];

export default function RepairReportScreen() {
  const { reportId, claimId } = useLocalSearchParams<{ reportId: string; claimId: string }>();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [workGroups, setWorkGroups] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'images' | 'notes'>('info');
  const [editFindings, setEditFindings] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, wgRes] = await Promise.all([
        fetch(`${API}/repair-reports/${reportId}`, { headers: authHeader() }),
        fetch(`${API}/work-groups`, { headers: authHeader() }),
      ]);
      const rJson = await rRes.json();
      const wgJson = await wgRes.json();
      setReport(rJson.data);
      setEditFindings(rJson.data?.findingsText ?? '');
      setWorkGroups(wgJson.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  const handleSaveFindings = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/repair-reports/${reportId}`, {
        method: 'PUT',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingsText: editFindings }),
      });
      Alert.alert('Kaydedildi', 'Tespit bulguları güncellendi.');
    } catch (e) { Alert.alert('Hata', 'Kaydedilemedi'); } finally { setSaving(false); }
  };

  const handleDownloadPdf = () => {
    const url = `${API}/repair-reports/${reportId}/pdf?view=external`;
    Alert.alert('PDF', `PDF linki: ${url}`);
  };

  const handleShareWhatsApp = async () => {
    try {
      const res = await fetch(`${API}/repair-reports/${reportId}/share-link`, { headers: authHeader() });
      const json = await res.json();
      Alert.alert('WhatsApp Paylaşım', json.data?.whatsappUrl ?? 'Link alınamadı');
    } catch (e) { Alert.alert('Hata', 'Link alınamadı'); }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color="#6366F1" /></View>;
  if (!report) return <View style={s.centered}><Text style={s.empty}>Rapor bulunamadı.</Text></View>;

  const groupedItems = new Map<string, { group: any; items: any[] }>();
  for (const item of report.items ?? []) {
    const key = item.workGroup?.id ?? 'other';
    if (!groupedItems.has(key)) groupedItems.set(key, { group: item.workGroup, items: [] });
    groupedItems.get(key)!.items.push(item);
  }

  const imageCats: Record<string, string> = { before: 'Öncesi', damage: 'Hasar', after: 'Sonrası' };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>← Geri</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{report.reportNo}</Text>
          <Text style={s.headerSub}>
            {report.reportType === 'single' ? 'Tek Hasarlı' : 'Çok Hasarlı'} · {new Date(report.reportDate).toLocaleDateString('tr-TR')}
          </Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: report.status === 'draft' ? '#F3F4F6' : '#EFF6FF' }]}>
          <Text style={[s.statusTxt, { color: report.status === 'draft' ? '#4B5563' : '#1D4ED8' }]}>
            {report.status === 'draft' ? 'Taslak' : 'Sunuldu'}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['info', 'items', 'images', 'notes'] as const).map((t) => {
          const label: Record<string, string> = { info: 'Bilgiler', items: 'Kalemler', images: 'Fotoğraflar', notes: 'Bulgular' };
          return (
            <TouchableOpacity key={t} style={[s.tab, activeTab === t && s.tabActive]} onPress={() => setActiveTab(t)}>
              <Text style={[s.tabTxt, activeTab === t && s.tabTxtActive]}>{label[t]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* INFO TAB */}
        {activeTab === 'info' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Dosya Bilgileri</Text>
            {[
              ['Sigorta Şirketi', report.claimFile?.insuranceCompany?.name],
              ['Hasar Dosya No', report.claimFile?.fileNo],
              ['Hasar Konusu', report.claimFile?.lossType],
              ['Sigortalı', report.claimFile?.customer?.fullName ?? report.claimFile?.customer?.companyName],
              ['Eksper/Ofis', report.inspectorName],
              ['Raporlayan', report.reporterName],
            ].map(([label, value]) => (
              <View key={label} style={s.infoRow}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text style={s.infoValue}>{value ?? '—'}</Text>
              </View>
            ))}

            {report.reportType === 'multi' && (report.damageTypes?.length ?? 0) > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={s.sectionLabel}>Hasar Nedenleri</Text>
                <View style={s.tagsRow}>
                  {report.damageTypes.map((dt: any) => (
                    <View key={dt.id} style={s.tag}><Text style={s.tagTxt}>{dt.damageTypeName}</Text></View>
                  ))}
                </View>
              </View>
            )}

            {/* Totals */}
            <View style={s.totalsBox}>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Toplam Satış</Text>
                <Text style={s.totalValue}>{fmt(report.totalSalesAmount)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Toplam Maliyet</Text>
                <Text style={s.totalValue}>{fmt(report.totalSupplierCost)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Brüt Kâr</Text>
                <Text style={[s.totalValue, { color: (report.grossProfit ?? 0) >= 0 ? '#10B981' : '#EF4444' }]}>{fmt(report.grossProfit)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Kâr Marjı</Text>
                <Text style={[s.totalValue, { color: (report.grossMarginPct ?? 0) >= 20 ? '#10B981' : (report.grossMarginPct ?? 0) >= 10 ? '#F59E0B' : '#EF4444' }]}>
                  %{(report.grossMarginPct ?? 0).toFixed(1)}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={s.actions}>
              <TouchableOpacity style={s.actionBtn} onPress={handleDownloadPdf}>
                <Text style={s.actionBtnTxt}>PDF İndir (Dış)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#25D366' }]} onPress={handleShareWhatsApp}>
                <Text style={s.actionBtnTxt}>WhatsApp Paylaş</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ITEMS TAB */}
        {activeTab === 'items' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Onarım Kalemleri ({(report.items ?? []).length} kalem)</Text>
            {groupedItems.size === 0 ? (
              <Text style={s.empty}>Kalem bulunamadı.</Text>
            ) : (
              Array.from(groupedItems.values()).map(({ group, items }) => {
                const groupSales = items.reduce((sum: number, i: any) => sum + i.salesTotal, 0);
                return (
                  <View key={group?.id ?? 'other'} style={{ marginBottom: 16 }}>
                    <View style={s.groupHeader}>
                      <Text style={s.groupName}>{group?.name ?? 'Diğer'}</Text>
                      <Text style={s.groupTotal}>{fmt(groupSales)}</Text>
                    </View>
                    {items.map((item: any) => (
                      <View key={item.id} style={s.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemDesc}>{item.jobDescription}</Text>
                          {item.location ? <Text style={s.itemSub}>📍 {item.location}</Text> : null}
                          {report.reportType === 'multi' && item.damageType ? (
                            <View style={s.dmgBadge}><Text style={s.dmgBadgeTxt}>{item.damageType.damageTypeName}</Text></View>
                          ) : null}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={s.itemQty}>{item.quantity} {item.unit}</Text>
                          <Text style={s.itemSales}>{fmt(item.salesTotal)}</Text>
                          <Text style={[s.itemMargin, { color: item.marginPct >= 20 ? '#10B981' : item.marginPct >= 10 ? '#F59E0B' : '#EF4444' }]}>
                            %{item.marginPct.toFixed(1)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* IMAGES TAB */}
        {activeTab === 'images' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Fotoğraflar ({(report.images ?? []).length})</Text>
            {!(report.images?.length) ? (
              <Text style={s.empty}>Henüz fotoğraf eklenmemiş.</Text>
            ) : (
              <View>
                {(['before', 'damage', 'after'] as const).map((cat) => {
                  const catImgs = (report.images ?? []).filter((i: any) => i.category === cat);
                  if (!catImgs.length) return null;
                  return (
                    <View key={cat} style={{ marginBottom: 12 }}>
                      <Text style={s.catLabel}>{imageCats[cat]}</Text>
                      {catImgs.map((img: any) => (
                        <View key={img.id} style={s.imgRow}>
                          <Text style={s.imgName}>{img.fileName}</Text>
                          {img.hasAnnotation && <Text style={s.annotBadge}>✎ İşaretli</Text>}
                          {img.caption ? <Text style={s.imgCaption}>{img.caption}</Text> : null}
                        </View>
                      ))}
                    </View>
                  );
                })}
                <Text style={s.imgNote}>Web uygulamasından fotoğraf ekleyebilir ve işaretleme yapabilirsiniz.</Text>
              </View>
            )}
          </View>
        )}

        {/* NOTES TAB — with speech-to-text */}
        {activeTab === 'notes' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Tespit Bulguları</Text>
            <TextInput
              style={s.textArea}
              multiline
              value={editFindings}
              onChangeText={setEditFindings}
              placeholder="Tespit bulgularını buraya yazın veya sesli not kullanın..."
              placeholderTextColor="#9CA3AF"
            />
            <View style={s.actions}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#6366F1' }]}
                onPress={() => router.push({
                  pathname: '/repair-report/voice-note' as any,
                  params: { reportId, claimId },
                })}
              >
                <Text style={s.actionBtnTxt}>Sesli Not Kaydet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, saving && { opacity: 0.6 }]} onPress={handleSaveFindings} disabled={saving}>
                <Text style={s.actionBtnTxt}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10 },
  backBtn: { paddingRight: 8 },
  backTxt: { color: '#6366F1', fontSize: 14 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTxt: { fontSize: 11, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366F1' },
  tabTxt: { fontSize: 12, color: '#9CA3AF' },
  tabTxtActive: { color: '#6366F1', fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  infoLabel: { fontSize: 12, color: '#9CA3AF', flex: 0.4 },
  infoValue: { fontSize: 12, color: '#111827', fontWeight: '500', flex: 0.6, textAlign: 'right' },
  sectionLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  tagTxt: { color: '#DC2626', fontSize: 11, fontWeight: '600' },
  totalsBox: { marginTop: 16, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 12, color: '#6B7280' },
  totalValue: { fontSize: 12, fontWeight: '700', color: '#111827' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: { flex: 1, backgroundColor: '#6366F1', padding: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  groupName: { fontSize: 11, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase' },
  groupTotal: { fontSize: 11, color: '#374151', fontWeight: '700' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', alignItems: 'flex-start' },
  itemDesc: { fontSize: 13, color: '#111827', fontWeight: '500' },
  itemSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  dmgBadge: { backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginTop: 3, alignSelf: 'flex-start' },
  dmgBadgeTxt: { color: '#DC2626', fontSize: 10 },
  itemQty: { fontSize: 11, color: '#9CA3AF', textAlign: 'right' },
  itemSales: { fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'right' },
  itemMargin: { fontSize: 11, fontWeight: '600', textAlign: 'right' },
  catLabel: { fontSize: 11, fontWeight: '700', color: '#6366F1', textTransform: 'uppercase', marginBottom: 6 },
  imgRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', gap: 8 },
  imgName: { flex: 1, fontSize: 12, color: '#374151' },
  annotBadge: { fontSize: 10, color: '#D97706', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  imgCaption: { fontSize: 11, color: '#9CA3AF' },
  imgNote: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 12 },
  textArea: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 13, color: '#111827', minHeight: 150, textAlignVertical: 'top', marginBottom: 12 },
});
