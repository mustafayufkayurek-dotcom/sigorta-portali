import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

const API = 'http://localhost:3000/api/v1';

const APPT_TYPE: Record<string, string> = {
  expert_visit: 'Eksper Ziyareti',
  inspection: 'Keşif',
  customer_meeting: 'Müşteri Toplantısı',
};

const APPT_STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: 'Planlandı', color: '#3B82F6' },
  scheduled: { label: 'Planlandı', color: '#3B82F6' },
  completed: { label: 'Tamamlandı', color: '#10B981' },
  cancelled: { label: 'İptal Edildi', color: '#EF4444' },
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}s ${m}d ${s}sn`;
  if (m > 0) return `${m}d ${s}sn`;
  return `${s}sn`;
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getToken = async () => (await SecureStore.getItemAsync('accessToken')) ?? '';

  const fetchAppointment = async () => {
    if (!id) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API}/adjusters/appointments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setAppointment(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointment();
  }, [id]);

  // Timer: check-in yapılmış, check-out yapılmamış
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (appointment?.checkedInAt && !appointment?.checkedOutAt) {
      const startMs = new Date(appointment.checkedInAt).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [appointment?.checkedInAt, appointment?.checkedOutAt]);

  // Yakın randevu kontrolü (5 saniye sonra bir kez)
  useEffect(() => {
    if (!appointment) return;
    if (appointment.checkedInAt) return;

    const checkProximity = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

        // Randevu adresinde koordinat varsa mesafe kontrolü
        const addr = appointment.claimFile?.propertyAddress;
        if (!addr?.latitude || !addr?.longitude) return;

        const dist = haversineMeters(
          addr.latitude, addr.longitude,
          loc.coords.latitude, loc.coords.longitude,
        );

        if (dist <= 300) {
          Alert.alert(
            'Randevu Noktasına Yaklaştınız',
            `Randevu noktasına yaklaşık ${Math.round(dist)} metre uzaktasınız. Check-in yapmak ister misiniz?`,
            [
              { text: 'Hayır', style: 'cancel' },
              { text: 'Check-in Yap', onPress: () => handleCheckIn() },
            ],
          );
        }
      } catch {
        // Sessizce geç
      }
    };

    const timer = setTimeout(checkProximity, 5000);
    return () => clearTimeout(timer);
  }, [appointment]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Check-in için konum iznine ihtiyaç vardır.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const token = await getToken();

      const res = await fetch(`${API}/adjusters/appointments/${id}/check-in`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        }),
      });
      const json = await res.json();

      if (json.success) {
        const msg = json.data.withinRange
          ? `Check-in başarılı. Randevu noktasındasınız (${json.data.distanceMeters ?? '?'} m).`
          : `Check-in kaydedildi. Uyarı: Randevu noktasından ${json.data.distanceMeters ?? '?'} m uzaktasınız.`;
        Alert.alert('Check-in', msg);
        await fetchAppointment();
      } else {
        Alert.alert('Hata', json.message ?? 'Check-in başarısız');
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Check-in yapılamadı');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    Alert.alert('Check-out', 'İşi tamamlayıp çıkış yapmak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Check-out Yap',
        onPress: async () => {
          setCheckingOut(true);
          try {
            const token = await getToken();
            const res = await fetch(`${API}/adjusters/appointments/${id}/check-out`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
            const json = await res.json();
            if (json.success) {
              const mins = json.data.durationMinutes;
              Alert.alert('Check-out', `Sahada geçirilen süre: ${mins} dakika.`);
              await fetchAppointment();
            }
          } catch (e: any) {
            Alert.alert('Hata', e?.message ?? 'Check-out yapılamadı');
          } finally {
            setCheckingOut(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Randevu bulunamadı.</Text>
      </View>
    );
  }

  const st = APPT_STATUS[appointment.status] ?? { label: appointment.status, color: '#9CA3AF' };
  const scheduledDate = new Date(appointment.scheduledAt);
  const isCheckedIn = !!appointment.checkedInAt;
  const isCheckedOut = !!appointment.checkedOutAt;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Tarih başlığı */}
      <View style={styles.dateHeader}>
        <Text style={styles.dateDay}>{scheduledDate.getDate()}</Text>
        <Text style={styles.dateMonth}>
          {scheduledDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })}
        </Text>
        <Text style={styles.dateTime}>
          {scheduledDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.typeRow}>
          <Text style={styles.typeLabel}>{APPT_TYPE[appointment.type] ?? appointment.type}</Text>
          <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {[
          { label: 'Hasar Dosyası', value: appointment.claimFile?.fileNo },
          { label: 'Eksper', value: appointment.adjuster?.name },
          { label: 'Lokasyon', value: appointment.location },
        ].map((f) =>
          f.value ? (
            <View key={f.label} style={styles.row}>
              <Text style={styles.rowLabel}>{f.label}</Text>
              <Text style={styles.rowValue}>{f.value}</Text>
            </View>
          ) : null,
        )}

        {appointment.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notlar</Text>
            <Text style={styles.notesText}>{appointment.notes}</Text>
          </View>
        )}
      </View>

      {/* Check-in / Check-out bölümü */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Saha Takibi</Text>

        {!isCheckedIn && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={handleCheckIn}
            disabled={checkingIn}
          >
            {checkingIn ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>Check-in Yap</Text>
            )}
          </TouchableOpacity>
        )}

        {isCheckedIn && !isCheckedOut && (
          <>
            <View style={styles.timerBox}>
              <Text style={styles.timerLabel}>Sahada Geçen Süre</Text>
              <Text style={styles.timerValue}>{formatDuration(elapsed)}</Text>
            </View>
            <Text style={styles.checkinTime}>
              Check-in: {new Date(appointment.checkedInAt).toLocaleTimeString('tr-TR')}
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#EF4444', marginTop: 10 }]}
              onPress={handleCheckOut}
              disabled={checkingOut}
            >
              {checkingOut ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Check-out Yap</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {isCheckedIn && isCheckedOut && (
          <View style={styles.completedBox}>
            <Text style={styles.completedText}>Tamamlandı</Text>
            <Text style={styles.checkinTime}>
              Check-in: {new Date(appointment.checkedInAt).toLocaleTimeString('tr-TR')}
            </Text>
            <Text style={styles.checkinTime}>
              Check-out: {new Date(appointment.checkedOutAt).toLocaleTimeString('tr-TR')}
            </Text>
            <Text style={styles.checkinTime}>
              Süre:{' '}
              {Math.round(
                (new Date(appointment.checkedOutAt).getTime() -
                  new Date(appointment.checkedInAt).getTime()) /
                  60_000,
              )}{' '}
              dakika
            </Text>
          </View>
        )}
      </View>

      {/* Navigasyon butonları */}
      <View style={styles.navBtns}>
        {appointment.claimFile?.id && (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: '#3B82F6' }]}
            onPress={() => router.push(`/adjuster-assignment?claimFileId=${appointment.claimFile.id}`)}
          >
            <Text style={styles.navBtnText}>Hasar Dosyasına Git</Text>
          </TouchableOpacity>
        )}
        {appointment.adjuster?.id && (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: '#6366F1' }]}
            onPress={() => router.push(`/adjuster-assignment?adjusterId=${appointment.adjuster.id}`)}
          >
            <Text style={styles.navBtnText}>Eksper Profili</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  dateHeader: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  dateDay: { fontSize: 48, fontWeight: '800', color: '#fff', lineHeight: 52 },
  dateMonth: { fontSize: 16, color: '#BFDBFE', marginTop: 2 },
  dateTime: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  rowLabel: { fontSize: 13, color: '#6B7280' },
  rowValue: { fontSize: 13, fontWeight: '600', color: '#111827', maxWidth: '60%', textAlign: 'right' },
  notesBox: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginTop: 10 },
  notesLabel: { fontSize: 11, color: '#3B82F6', fontWeight: '600', marginBottom: 4 },
  notesText: { fontSize: 13, color: '#1E3A5F' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  actionBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  timerBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  timerLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  timerValue: { fontSize: 28, fontWeight: '800', color: '#10B981' },
  checkinTime: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  completedBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 14,
  },
  completedText: { fontSize: 14, fontWeight: '700', color: '#10B981', marginBottom: 8 },
  navBtns: { gap: 8 },
  navBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },
  navBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
