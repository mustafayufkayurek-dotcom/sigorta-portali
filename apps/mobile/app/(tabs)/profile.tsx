import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useLocationTracking } from '../../hooks/useLocationTracking';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [toggling, setToggling] = useState(false);
  const { isTracking, startTracking, stopTracking } = useLocationTracking();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await SecureStore.getItemAsync('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  };

  const handleTrackingToggle = async (value: boolean) => {
    setToggling(true);
    try {
      if (value) {
        await startTracking();
      } else {
        await stopTracking();
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Konum takibi değiştirilemedi');
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Çıkış', 'Çıkış yapmak istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış',
        style: 'destructive',
        onPress: async () => {
          if (isTracking) await stopTracking();
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
          await SecureStore.deleteItemAsync('user');
          router.replace('/');
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Ad Soyad</Text>
        <Text style={styles.value}>
          {user.firstName} {user.lastName}
        </Text>

        <Text style={styles.label}>E-posta</Text>
        <Text style={styles.value}>{user.email}</Text>

        <Text style={styles.label}>Rol</Text>
        <Text style={styles.value}>{user.role?.name || 'N/A'}</Text>
      </View>

      {/* Konum Takibi */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Konum Takibi</Text>
        <View style={styles.trackingRow}>
          <View style={styles.trackingInfo}>
            <Text style={styles.trackingLabel}>Arka Plan Konum Takibi</Text>
            <Text style={[styles.trackingStatus, { color: isTracking ? '#10B981' : '#9CA3AF' }]}>
              {toggling ? 'Değiştiriliyor...' : isTracking ? 'Aktif' : 'Pasif'}
            </Text>
          </View>
          {toggling ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Switch
              value={isTracking}
              onValueChange={handleTrackingToggle}
              trackColor={{ false: '#D1D5DB', true: '#6EE7B7' }}
              thumbColor={isTracking ? '#10B981' : '#9CA3AF'}
            />
          )}
        </View>
        <Text style={styles.trackingNote}>
          Aktif olduğunda konumunuz her 5 dakikada bir veya 50 metre hareket sonrasında
          sisteme iletilir.
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 12,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackingInfo: {
    flex: 1,
  },
  trackingLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  trackingStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  trackingNote: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 10,
    lineHeight: 16,
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
