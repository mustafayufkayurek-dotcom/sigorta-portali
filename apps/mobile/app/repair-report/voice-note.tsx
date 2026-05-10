import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Audio } from 'expo-av';

const API = 'http://localhost:3000/api/v1';
const getToken = () => '';
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

type State = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export default function VoiceNoteScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [transcript, setTranscript] = useState('');
  const [applying, setApplying] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Hata', 'Mikrofon izni gereklidir');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setState('recording');
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Kayıt başlatılamadı');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setState('processing');
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) { setState('error'); return; }

      // Upload to speech endpoint
      const fd = new FormData();
      fd.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      const res = await fetch(`${API}/speech/transcribe`, {
        method: 'POST',
        headers: { ...authHeader() },
        body: fd,
      });
      const json = await res.json();
      setTranscript(json.text ?? '');
      setState('done');
    } catch (e) {
      console.error(e);
      setState('error');
      Alert.alert('Hata', 'Ses dönüştürme başarısız');
    }
  };

  const applyTranscript = async () => {
    if (!transcript || !reportId) return;
    setApplying(true);
    try {
      // Fetch existing findings then append
      const r = await fetch(`${API}/repair-reports/${reportId}`, { headers: authHeader() });
      const existing = ((await r.json())?.data?.findingsText ?? '');
      const newText = existing ? `${existing}\n\n${transcript}` : transcript;

      await fetch(`${API}/repair-reports/${reportId}`, {
        method: 'PUT',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingsText: newText }),
      });
      Alert.alert('Başarılı', 'Sesli not tespit bulgularına eklendi', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Hata', 'Kaydedilemedi');
    } finally { setApplying(false); }
  };

  const reset = () => {
    setTranscript('');
    setState('idle');
  };

  const stateInfo: Record<State, { emoji: string; label: string; color: string }> = {
    idle: { emoji: '🎙️', label: 'Kayıt Başlatmak İçin Dokunun', color: '#6366F1' },
    recording: { emoji: '🔴', label: 'Kaydediliyor... Durdurmak için dokunun', color: '#EF4444' },
    processing: { emoji: '⏳', label: 'Ses yazıya çevriliyor...', color: '#F59E0B' },
    done: { emoji: '✅', label: 'Transkripsiyon tamamlandı', color: '#10B981' },
    error: { emoji: '❌', label: 'Hata oluştu', color: '#EF4444' },
  };

  const info = stateInfo[state];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sesli Not</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.main}>
        <View style={[s.iconCircle, { backgroundColor: info.color + '20' }]}>
          <Text style={s.iconEmoji}>{info.emoji}</Text>
        </View>
        <Text style={[s.stateLabel, { color: info.color }]}>{info.label}</Text>

        {state === 'processing' && <ActivityIndicator size="large" color="#F59E0B" style={{ marginTop: 16 }} />}

        {(state === 'idle' || state === 'recording') && (
          <TouchableOpacity
            style={[s.mainBtn, { backgroundColor: state === 'recording' ? '#EF4444' : '#6366F1' }]}
            onPress={state === 'idle' ? startRecording : stopRecording}
          >
            <Text style={s.mainBtnTxt}>{state === 'idle' ? 'Kayıt Başlat' : 'Kaydı Durdur'}</Text>
          </TouchableOpacity>
        )}

        {state === 'done' && !!transcript && (
          <View style={s.transcriptBox}>
            <Text style={s.transcriptLabel}>Transkripsiyon:</Text>
            <Text style={s.transcriptText}>{transcript}</Text>
            <View style={s.actions}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#10B981' }]} onPress={applyTranscript} disabled={applying}>
                <Text style={s.btnTxt}>{applying ? 'Ekleniyor...' : 'Bulgulara Ekle'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#6B7280' }]} onPress={reset}>
                <Text style={s.btnTxt}>Tekrar Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {state === 'error' && (
          <TouchableOpacity style={[s.mainBtn, { backgroundColor: '#6366F1', marginTop: 16 }]} onPress={reset}>
            <Text style={s.mainBtnTxt}>Tekrar Dene</Text>
          </TouchableOpacity>
        )}

        <View style={s.infoBox}>
          <Text style={s.infoTxt}>Ses kaydı Whisper AI ile Türkçe olarak yazıya çevrilir.</Text>
          {Platform.OS === 'ios' ? null : <Text style={s.infoTxt}>Android: m4a/webm formatları desteklenir.</Text>}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: {},
  backTxt: { color: '#6366F1', fontSize: 14 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  iconEmoji: { fontSize: 48 },
  stateLabel: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 24 },
  mainBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16, marginTop: 8 },
  mainBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  transcriptBox: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginTop: 16 },
  transcriptLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  transcriptText: { fontSize: 14, color: '#111827', lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  infoBox: { marginTop: 32, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12 },
  infoTxt: { fontSize: 12, color: '#1D4ED8', textAlign: 'center', marginBottom: 2 },
});
