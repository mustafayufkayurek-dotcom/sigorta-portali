/**
 * AR ölçüm motoru sözleşmesi.
 * Dilim 2b: @reactvision/react-viro (ARKit/ARCore) — development build gerekir.
 */

export type ArEngineKind = 'manual' | 'arkit' | 'arcore' | 'unavailable';

export type ArMeasureResult = {
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  engine: ArEngineKind;
};

export function getArEngineStatus(): {
  kind: ArEngineKind;
  ready: boolean;
  message: string;
} {
  try {
    require('@reactvision/react-viro');
  } catch {
    return {
      kind: 'unavailable',
      ready: false,
      message: 'AR paketi yüklü değil. Manuel ölçü ile devam edin.',
    };
  }

  // Expo Go'da native modül bağlı değildir; development build gerekir.
  const isExpoGo =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (global as any).expo !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).expo?.modules?.ExponentConstants?.appOwnership === 'expo';

  if (isExpoGo) {
    return {
      kind: 'unavailable',
      ready: false,
      message:
        'ARKit/ARCore Expo Go’da çalışmaz. Development build ile açın; şimdilik manuel ölçü kullanılabilir.',
    };
  }

  return {
    kind: PlatformKind(),
    ready: true,
    message: 'AR motoru hazır — Kapı için genişlik ve yüksekliği iki nokta ile ölçün.',
  };
}

function PlatformKind(): ArEngineKind {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as typeof import('react-native');
    return Platform.OS === 'ios' ? 'arkit' : 'arcore';
  } catch {
    return 'unavailable';
  }
}
