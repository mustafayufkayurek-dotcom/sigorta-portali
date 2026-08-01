import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal } from 'react-native';

type Point3 = { x: number; y: number; z: number };

export type ArAxisMeasure = {
  widthCm: number | null;
  heightCm: number | null;
};

type Props = {
  visible: boolean;
  onMeasured: (values: ArAxisMeasure) => void;
  onCancel: () => void;
};

function distMeters(a: Point3, b: Point3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function metersToCm(m: number): number {
  return Math.round(m * 1000) / 10;
}

/**
 * Kapı AR ölçümü — ARKit (iOS) / ARCore (Android).
 * Development build gerekir (Expo Go desteklemez).
 */
export function ArDoorMeasureSession({ visible, onMeasured, onCancel }: Props) {
  const [axis, setAxis] = useState<'width' | 'height'>('width');
  const [widthCm, setWidthCm] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [p1, setP1] = useState<Point3 | null>(null);
  const [trackingLabel, setTrackingLabel] = useState('Başlatılıyor…');

  const Viro = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@reactvision/react-viro') as Record<string, any>;
    } catch {
      return null;
    }
  }, []);

  const handleSceneClick = useCallback(
    (position: number[]) => {
      if (!position || position.length < 3) return;
      const point: Point3 = { x: position[0], y: position[1], z: position[2] };
      if (!p1) {
        setP1(point);
        setTrackingLabel('İkinci noktayı seçin');
        return;
      }
      const cm = metersToCm(distMeters(p1, point));
      setP1(null);
      if (axis === 'width') {
        setWidthCm(cm);
        setAxis('height');
        setTrackingLabel('Yükseklik için iki nokta seçin');
      } else {
        setHeightCm(cm);
        setTrackingLabel('Ölçüyü kullanabilirsiniz');
      }
    },
    [p1, axis],
  );

  if (!visible) return null;

  if (!Viro?.ViroARSceneNavigator || !Viro?.ViroARScene) {
    return (
      <Modal visible animationType="slide">
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>AR Motoru Hazır Değil</Text>
          <Text style={styles.fallbackBody}>
            ARKit/ARCore için development build gerekir (Expo Go yetmez). Manuel ölçü ile devam
            edin.
          </Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Geri</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  const { ViroARScene, ViroARSceneNavigator, ViroText } = Viro;

  const MeasureScene = (sceneProps: any) => {
    const appProps = sceneProps?.arSceneNavigator?.viroAppProps ?? {};
    return (
      <ViroARScene
        onTrackingUpdated={(state: number) => {
          if (typeof appProps.onTrackingState === 'function') {
            appProps.onTrackingState(state);
          }
        }}
        onClick={(position: number[]) => {
          if (typeof appProps.onSceneClick === 'function') {
            appProps.onSceneClick(position);
          }
        }}
      >
        <ViroText
          text={Platform.OS === 'ios' ? 'ARKit · İki nokta' : 'ARCore · İki nokta'}
          scale={[0.25, 0.25, 0.25]}
          position={[0, 0.05, -0.7]}
          style={{ fontSize: 18, color: '#ffffff' }}
        />
      </ViroARScene>
    );
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        <ViroARSceneNavigator
          autofocus
          initialScene={{ scene: MeasureScene }}
          viroAppProps={{
            onSceneClick: handleSceneClick,
            onTrackingState: (state: number) => {
              // TRACKING_NORMAL ≈ 3
              setTrackingLabel(state === 3 ? 'Takip aktif — nokta seçin' : 'Düz yüzeye tutun…');
            },
          }}
          style={styles.ar}
        />
        <View style={styles.hud}>
          <Text style={styles.hudTitle}>
            {axis === 'width' ? '1) Genişlik Ölç' : '2) Yükseklik Ölç'}
          </Text>
          <Text style={styles.hudSub}>{trackingLabel}</Text>
          <Text style={styles.hudVals}>
            G: {widthCm != null ? `${widthCm} cm` : '—'} · Y:{' '}
            {heightCm != null ? `${heightCm} cm` : '—'}
          </Text>
          <View style={styles.hudRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, widthCm == null && heightCm == null && styles.disabled]}
              onPress={() => onMeasured({ widthCm, heightCm })}
              disabled={widthCm == null && heightCm == null}
            >
              <Text style={styles.applyText}>Ölçüyü Kullan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  ar: { flex: 1 },
  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.88)',
  },
  hudTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  hudSub: { color: '#cbd5e1', fontSize: 12, marginBottom: 8 },
  hudVals: { color: '#e2e8f0', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  hudRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#64748b',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { color: '#e2e8f0', fontWeight: '600' },
  applyBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f172a',
  },
  fallbackTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  fallbackBody: { color: '#cbd5e1', fontSize: 14, lineHeight: 20, marginBottom: 16 },
});
