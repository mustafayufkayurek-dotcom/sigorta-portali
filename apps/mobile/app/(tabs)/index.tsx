import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ScreenCapture from 'expo-screen-capture';
import axios from 'axios';
import { useRouter } from 'expo-router';

const API_BASE = 'http://localhost:3000/api/v1';

export default function AssignedClaimsScreen() {
  const router = useRouter();
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenshotWarning, setScreenshotWarning] = useState(false);

  // Ekran görüntüsü uyarısı
  useEffect(() => {
    const subscription = ScreenCapture.addScreenshotListener(() => {
      setScreenshotWarning(true);
    });
    return () => subscription.remove();
  }, []);

  const fetchClaims = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const response = await axios.get(`${API_BASE}/claim-files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClaims(response.data.data || []);
    } catch {
      // sessiz hata
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  /**
   * Arama başlatma: backend'den callUrl alınır, numara frontend'de gösterilmez
   */
  const handleCall = async (customerId: string) => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const response = await axios.post(
        `${API_BASE}/customers/${customerId}/initiate-call`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const callUrl: string = response.data?.data?.callUrl;
      if (callUrl) {
        await Linking.openURL(callUrl);
      }
    } catch {
      Alert.alert('Hata', 'Arama başlatılamadı');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Ekran görüntüsü uyarı modalı */}
      <Modal
        visible={screenshotWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setScreenshotWarning(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Güvenlik Uyarısı</Text>
            <Text style={styles.modalBody}>
              Bu ekranda müşteri bilgileri bulunmaktadır. Ekran görüntüsü almak
              güvenlik politikalarına aykırıdır ve kayıt altına alınmıştır.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setScreenshotWarning(false)}
            >
              <Text style={styles.modalButtonText}>Anladım</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        data={claims}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Dosya no — kopyalanabilir değil */}
            <Text selectable={false} style={styles.fileNo}>
              {item.fileNo}
            </Text>
            <Text selectable={false} style={styles.policyNo}>
              Poliçe: {item.policyNo}
            </Text>
            <Text selectable={false} style={styles.status}>
              {item.currentStatus?.name || 'N/A'}
            </Text>

            {/* Müşteri bilgileri — telefon maskelenmiş olarak gelir */}
            {item.customer && (
              <View style={styles.customerRow}>
                <Text selectable={false} style={styles.customerName}>
                  {item.customer.fullName ?? item.customer.companyName ?? '—'}
                </Text>
                {item.customer.phone && (
                  <Text selectable={false} style={styles.maskedPhone}>
                    {item.customer.phone}
                  </Text>
                )}
              </View>
            )}

            {/* Ara butonu: numara gizli, native dialer açılır */}
            {item.customer?.id && (
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => handleCall(item.customer.id)}
              >
                <Text style={styles.callButtonText}>Ara</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.measureButton}
              onPress={() =>
                router.push({
                  pathname: '/smart-measure/[claimFileId]',
                  params: { claimFileId: item.id, fileNo: item.fileNo },
                })
              }
            >
              <Text style={styles.measureButtonText}>Kamera İle Ölç</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Atanmış dosya bulunmuyor</Text>
        }
      />
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
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fileNo: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  policyNo: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  status: {
    fontSize: 12,
    color: '#2563eb',
    marginBottom: 8,
  },
  customerRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  maskedPhone: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  callButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  measureButton: {
    marginTop: 8,
    backgroundColor: '#1d4ed8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  measureButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    marginTop: 50,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});
