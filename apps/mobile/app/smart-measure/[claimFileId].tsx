import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE, authHeader } from '../../lib/api';
import { getArEngineStatus } from '../../lib/ar-measure-engine';
import { ArDoorMeasureSession } from '../../components/ArDoorMeasureSession';

function cmToMm(cm: number): number {
  return Math.round(cm * 10);
}

/** Dilim 2 — Kapı akıllı ölçüm (ARKit/ARCore + foto + kayıt). */
export default function SmartMeasureDoorScreen() {
  const { claimFileId, fileNo } = useLocalSearchParams<{
    claimFileId: string;
    fileNo?: string;
  }>();
  const router = useRouter();
  const arStatus = useMemo(() => getArEngineStatus(), []);

  const [title, setTitle] = useState('Kapı');
  const [elementType, setElementType] = useState('kapi');
  const [locationLabel, setLocationLabel] = useState('');
  const [roomLabel, setRoomLabel] = useState('');
  const [widthCm, setWidthCm] = useState('90');
  const [heightCm, setHeightCm] = useState('210');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiBounds, setAiBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const [arOpen, setArOpen] = useState(false);
  const [measureSource, setMeasureSource] = useState<'mobile_ar' | 'manual_correction'>(
    'manual_correction',
  );

  const widthNum = Number(widthCm.replace(',', '.'));
  const heightNum = Number(heightCm.replace(',', '.'));
  const widthMm = Number.isFinite(widthNum) && widthNum > 0 ? cmToMm(widthNum) : null;
  const heightMm = Number.isFinite(heightNum) && heightNum > 0 ? cmToMm(heightNum) : null;
  const areaM2 =
    widthMm != null && heightMm != null
      ? Math.round(((widthMm * heightMm) / 1_000_000) * 1000) / 1000
      : null;

  const runDetect = useCallback(
    async (uri: string) => {
      if (!claimFileId) return;
      setDetecting(true);
      setAiMessage(null);
      try {
        const headers = await authHeader();
        const form = new FormData();
        form.append('file', {
          uri,
          name: 'smart-measure-detect.jpg',
          type: 'image/jpeg',
        } as unknown as Blob);
        const res = await axios.post(
          `${API_BASE}/claim-files/${claimFileId}/smart-measures/detect`,
          form,
          { headers: { ...headers, 'Content-Type': 'multipart/form-data' } },
        );
        const data = res.data?.data;
        if (data?.elementType) setElementType(String(data.elementType));
        if (data?.title) setTitle(String(data.title));
        if (typeof data?.aiConfidence === 'number') setAiConfidence(data.aiConfidence);
        else setAiConfidence(null);
        setAiBounds(data?.bounds ?? null);
        setAiMessage(data?.message ? String(data.message) : null);
        if (data?.lowConfidence) {
          Alert.alert('Düşük Güven', data.message || 'Nesne tipini kontrol edin.');
        }
      } catch {
        setAiMessage('Nesne önerisi alınamadı — tipi elle düzeltebilirsiniz.');
      } finally {
        setDetecting(false);
      }
    },
    [claimFileId],
  );

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin Gerekli', 'Kamera izni olmadan ölçüm fotoğrafı alınamaz.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
      exif: true,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      void runDetect(uri);
    }
  }, [runDetect]);

  const save = useCallback(async () => {
    if (!claimFileId) {
      Alert.alert('Hata', 'Dosya bilgisi eksik.');
      return;
    }
    if (!Number.isFinite(widthNum) || widthNum <= 0 || !Number.isFinite(heightNum) || heightNum <= 0) {
      Alert.alert('Ölçü', 'Geçerli genişlik ve yükseklik girin (cm).');
      return;
    }

    setSaving(true);
    try {
      const headers = await authHeader();
      let photoFileAssetId: string | null = null;

      if (photoUri) {
        const form = new FormData();
        form.append('file', {
          uri: photoUri,
          name: 'smart-measure.jpg',
          type: 'image/jpeg',
        } as unknown as Blob);
        const up = await axios.post(
          `${API_BASE}/claim-files/${claimFileId}/smart-measures/photo`,
          form,
          {
            headers: {
              ...headers,
              'Content-Type': 'multipart/form-data',
            },
          },
        );
        photoFileAssetId = up.data?.data?.fileAssetId ?? null;
      }

      let gpsLat: number | null = null;
      let gpsLng: number | null = null;
      try {
        const locPerm = await Location.requestForegroundPermissionsAsync();
        if (locPerm.granted) {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          gpsLat = loc.coords.latitude;
          gpsLng = loc.coords.longitude;
        }
      } catch {
        // konum opsiyonel
      }

      await axios.post(
        `${API_BASE}/claim-files/${claimFileId}/smart-measures`,
        {
          elementType,
          title: title.trim() || 'Kapı',
          locationLabel: locationLabel.trim() || null,
          roomLabel: roomLabel.trim() || null,
          widthMm,
          heightMm,
          photoFileAssetId,
          aiConfidence,
          aiDetectedType: elementType,
          isAiProduced: aiConfidence != null,
          isUserCorrected: measureSource !== 'mobile_ar',
          isManualRevision: measureSource === 'manual_correction',
          overlayJson: aiBounds ? { bounds: aiBounds } : null,
          gpsLat,
          gpsLng,
          deviceInfoJson: {
            brand: Device.brand,
            modelName: Device.modelName,
            osName: Device.osName,
            osVersion: Device.osVersion,
            arEngine: arStatus.kind,
          },
          measuredAt: new Date().toISOString(),
          source: measureSource === 'manual_correction' ? 'manual' : measureSource,
          note: measureSource === 'mobile_ar' ? 'ARKit/ARCore iki nokta ölçümü' : arStatus.message,
        },
        { headers },
      );

      Alert.alert('Kaydedildi', 'Ölçüm dosyaya işlendi.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Kayıt başarısız. Bağlantı ve yetkiyi kontrol edin.';
      Alert.alert('Hata', msg);
    } finally {
      setSaving(false);
    }
  }, [
    claimFileId,
    photoUri,
    title,
    elementType,
    locationLabel,
    roomLabel,
    widthNum,
    heightNum,
    widthMm,
    heightMm,
    aiConfidence,
    aiBounds,
    arStatus.message,
    arStatus.kind,
    measureSource,
    router,
  ]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Akıllı Ölçüm</Text>
      <Text style={styles.fileNo}>{fileNo ? `Dosya ${fileNo}` : 'Hasar Dosyası'}</Text>
      <Text style={styles.hint}>{arStatus.message}</Text>

      <TouchableOpacity style={styles.arBtn} onPress={() => setArOpen(true)}>
        <Text style={styles.arBtnText}>Kamera İle Ölç (AR)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.photoBtn} onPress={() => void takePhoto()} disabled={detecting}>
        <Text style={styles.photoBtnText}>
          {detecting ? 'Nesne Tanınıyor…' : photoUri ? 'Fotoğrafı Yenile' : 'Kanıt Fotoğrafı Çek'}
        </Text>
      </TouchableOpacity>
      {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}
      {aiMessage ? (
        <Text style={[styles.aiBox, aiConfidence != null && aiConfidence < 0.7 && styles.aiWarn]}>
          {aiMessage}
          {aiConfidence != null ? ` · Güven %${Math.round(aiConfidence * 100)}` : ''}
        </Text>
      ) : null}

      <Text style={styles.label}>Eleman Tipi (kod)</Text>
      <TextInput
        style={styles.input}
        value={elementType}
        onChangeText={setElementType}
        placeholder="kapi"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Başlık</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Kapı" />

      <Text style={styles.label}>Mahal</Text>
      <TextInput
        style={styles.input}
        value={locationLabel}
        onChangeText={setLocationLabel}
        placeholder="Örn. Salon"
      />

      <Text style={styles.label}>Oda</Text>
      <TextInput
        style={styles.input}
        value={roomLabel}
        onChangeText={setRoomLabel}
        placeholder="Örn. Giriş"
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Genişlik (cm)</Text>
          <TextInput
            style={styles.input}
            value={widthCm}
            onChangeText={(v) => {
              setWidthCm(v);
              setMeasureSource('manual_correction');
            }}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Yükseklik (cm)</Text>
          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={(v) => {
              setHeightCm(v);
              setMeasureSource('manual_correction');
            }}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.metrics}>
        <Text style={styles.metricText}>Alan: {areaM2 != null ? `${areaM2} m²` : '—'}</Text>
        <Text style={styles.metricText}>
          API: {widthMm != null && heightMm != null ? `${widthMm} × ${heightMm} mm` : '—'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={() => void save()}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Onayla Ve Kaydet</Text>
        )}
      </TouchableOpacity>

      <ArDoorMeasureSession
        visible={arOpen}
        onCancel={() => setArOpen(false)}
        onMeasured={(v) => {
          if (v.widthCm != null) setWidthCm(String(v.widthCm));
          if (v.heightCm != null) setHeightCm(String(v.heightCm));
          setMeasureSource('mobile_ar');
          setArOpen(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  eyebrow: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  fileNo: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  hint: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
  },
  arBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  arBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  photoBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  photoBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  aiBox: {
    fontSize: 12,
    color: '#1e3a8a',
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    lineHeight: 18,
  },
  aiWarn: {
    color: '#92400e',
    backgroundColor: '#fef3c7',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#e2e8f0',
  },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  metrics: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 16,
  },
  metricText: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  saveBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
