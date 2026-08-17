import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const API = 'http://localhost:3000/api/v1';
const getToken = () => '';

const REPORT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Taslak', color: '#9CA3AF' },
  submitted: { label: 'Sunuldu', color: '#3B82F6' },
  approved: { label: 'Onaylandı', color: '#10B981' },
  rejected: { label: 'Reddedildi', color: '#EF4444' },
};

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

export default function AdjusterReportScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reportId) return;
    fetch(`${API}/adjusters/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((json) => setReport(json.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Rapor bulunamadı.</Text>
      </View>
    );
  }

  const st = REPORT_STATUS[report.status] ?? { label: report.status, color: '#9CA3AF' };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header card */}
      <View style={[styles.headerCard, { borderLeftColor: st.color }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.reportNo}>Rapor: {report.reportNo}</Text>
            <Text style={styles.reportDate}>
              {report.reportDate
                ? new Date(report.reportDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        {report.estimatedDamage != null && (
          <View style={styles.damageBox}>
            <Text style={styles.damageLabel}>Tahmini Hasar</Text>
            <Text style={styles.damageValue}>{fmt(report.estimatedDamage)}</Text>
          </View>
        )}
      </View>

      {/* Tavsiye */}
      {report.recommendation && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tavsiye</Text>
          <Text style={styles.bodyText}>{report.recommendation}</Text>
        </View>
      )}

      {/* Red sebebi */}
      {report.status === 'rejected' && report.rejectionReason && (
        <View style={[styles.card, styles.rejectedCard]}>
          <Text style={[styles.sectionTitle, { color: '#B91C1C' }]}>Red Sebebi</Text>
          <Text style={styles.bodyText}>{report.rejectionReason}</Text>
        </View>
      )}

      {/* Atama detayı */}
      {report.assignment && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Atama Bilgileri</Text>
          {[
            { label: 'Dosya No', value: report.assignment.claimFile?.fileNo },
            { label: 'Eksper', value: report.assignment.adjuster?.name },
            { label: 'Atanma Tarihi', value: report.assignment.assignedAt ? new Date(report.assignment.assignedAt).toLocaleDateString('tr-TR') : null },
          ].map((f) =>
            f.value ? (
              <View key={f.label} style={styles.row}>
                <Text style={styles.rowLabel}>{f.label}</Text>
                <Text style={styles.rowValue}>{f.value}</Text>
              </View>
            ) : null,
          )}
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Geri Dön</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reportNo: { fontSize: 18, fontWeight: '800', color: '#111827' },
  reportDate: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  damageBox: { marginTop: 14, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12 },
  damageLabel: { fontSize: 11, color: '#3B82F6', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  damageValue: { fontSize: 26, fontWeight: '800', color: '#1E40AF' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  rejectedCard: { borderWidth: 1, borderColor: '#FECACA' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  bodyText: { fontSize: 14, color: '#4B5563', lineHeight: 22 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  rowLabel: { fontSize: 13, color: '#6B7280' },
  rowValue: { fontSize: 13, fontWeight: '600', color: '#111827', maxWidth: '60%', textAlign: 'right' },
  backBtn: { backgroundColor: '#6366F1', padding: 14, borderRadius: 12, alignItems: 'center' },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
