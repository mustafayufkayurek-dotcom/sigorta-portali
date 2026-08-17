import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const API = 'http://localhost:3000/api/v1';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  accepted: 'Kabul Edildi',
  rejected: 'Reddedildi',
  completed: 'Tamamlandı',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  accepted: '#3B82F6',
  rejected: '#EF4444',
  completed: '#10B981',
};

export default function AdjusterAssignmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  const getToken = () => '';

  useEffect(() => {
    if (!id) return;
    loadAssignment();
  }, [id]);

  const loadAssignment = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/adjusters/assignments/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setAssignment(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (status: 'accepted' | 'rejected') => {
    setResponding(true);
    try {
      await fetch(`${API}/adjusters/assignments/${id}/respond`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      Alert.alert('Başarılı', status === 'accepted' ? 'Atama kabul edildi.' : 'Atama reddedildi.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Atama bulunamadı.</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[assignment.status] ?? '#9CA3AF';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.card}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[assignment.status] ?? assignment.status}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Eksper Ataması</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Dosya No</Text>
          <Text style={styles.value}>{assignment.claimFile?.fileNo ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Hasar No</Text>
          <Text style={styles.value}>{assignment.claimFile?.claimNo ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Eksper</Text>
          <Text style={styles.value}>{assignment.adjuster?.name ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Şirket</Text>
          <Text style={styles.value}>{assignment.adjuster?.company ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Atanma Tarihi</Text>
          <Text style={styles.value}>
            {assignment.assignedAt
              ? new Date(assignment.assignedAt).toLocaleDateString('tr-TR')
              : '—'}
          </Text>
        </View>
        {assignment.appointmentDate && (
          <View style={styles.row}>
            <Text style={styles.label}>Randevu Tarihi</Text>
            <Text style={styles.value}>
              {new Date(assignment.appointmentDate).toLocaleString('tr-TR')}
            </Text>
          </View>
        )}
        {assignment.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{assignment.notes}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      {assignment.status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            disabled={responding}
            onPress={() => handleRespond('accepted')}
          >
            <Text style={styles.actionBtnText}>{responding ? 'İşleniyor...' : 'Kabul Et'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            disabled={responding}
            onPress={() => handleRespond('rejected')}
          >
            <Text style={styles.actionBtnText}>{responding ? 'İşleniyor...' : 'Reddet'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {assignment.status === 'accepted' && !assignment.report && (
        <TouchableOpacity
          style={[styles.actionBtn, styles.reportBtn]}
          onPress={() => router.push(`/adjuster-report?assignmentId=${id}`)}
        >
          <Text style={styles.actionBtnText}>Rapor Gir</Text>
        </TouchableOpacity>
      )}

      {assignment.report && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#6366F1' }]}
          onPress={() => router.push(`/adjuster-report?reportId=${assignment.report.id}`)}
        >
          <Text style={styles.actionBtnText}>Raporu Görüntüle</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12, marginTop: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  label: { fontSize: 13, color: '#6B7280' },
  value: { fontSize: 13, fontWeight: '600', color: '#111827', maxWidth: '60%', textAlign: 'right' },
  notesBox: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginTop: 10 },
  notesText: { fontSize: 13, color: '#92400E' },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  acceptBtn: { backgroundColor: '#10B981' },
  rejectBtn: { backgroundColor: '#EF4444' },
  reportBtn: { backgroundColor: '#6366F1' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
