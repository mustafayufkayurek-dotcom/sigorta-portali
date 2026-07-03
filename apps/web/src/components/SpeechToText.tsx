'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

// ─── Web Speech API type declarations ────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// ─── SpeechRecognition factory (cross-browser) ───────────────────────────────
function createSpeechRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === 'undefined') return null;
  const SRConstructor =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SRConstructor) return null;
  return new SRConstructor() as SpeechRecognitionInstance;
}

type MicAccessReason = 'denied' | 'unavailable' | 'insecure';

type MicAccessResult =
  | { ok: true }
  | { ok: false; reason: MicAccessReason };

/** Tarayıcı izin penceresini tetiklemek için önce getUserMedia kullan */
async function requestMicrophoneAccess(): Promise<MicAccessResult> {
  if (typeof window === 'undefined') return { ok: false, reason: 'unavailable' };
  if (!window.isSecureContext) return { ok: false, reason: 'insecure' };

  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      if (status.state === 'denied') {
        return { ok: false, reason: 'denied' };
      }
    } catch {
      // Bazı tarayıcılar microphone permission name desteklemez — getUserMedia dene
    }
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: 'unavailable' };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (err: unknown) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { ok: false, reason: 'denied' };
    }
    return { ok: false, reason: 'unavailable' };
  }
}

function micAccessErrorMessage(reason: MicAccessReason): string {
  switch (reason) {
    case 'denied':
      return 'Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden mikrofonu açın.';
    case 'insecure':
      return 'Ses kaydı yalnızca güvenli bağlantıda (HTTPS) çalışır.';
    default:
      return 'Mikrofon bulunamadı veya erişilemiyor.';
  }
}

// ─── STT Interface (ileride Whisper / Google Cloud STT için) ─────────────────
export interface STTProvider {
  name: string;
  start(): void;
  stop(): void;
}

// ─── Props ───────────────────────────────────────────────────────────────────
export interface SpeechToTextProps {
  /** Metin tamamlandığında çağrılır */
  onTranscript: (text: string) => void;
  /** Anlık (interim) transcript için opsiyonel callback */
  onInterim?: (text: string) => void;
  /** Butona eklenecek ek CSS sınıfları */
  className?: string;
  /** Buton boyutu — default "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Devre dışı bırak */
  disabled?: boolean;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 min-w-[32px]',
  md: 'w-11 h-11 min-w-[44px]',
  lg: 'w-12 h-12 min-w-[48px]',
};

const ICON_SIZE = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export default function SpeechToText({
  onTranscript,
  onInterim,
  className = '',
  size = 'md',
  disabled = false,
}: SpeechToTextProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTextRef = useRef('');
  const micGrantedRef = useRef(false);

  // Tarayıcı desteğini kontrol et
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      !!(
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      );
    setIsSupported(supported);
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setInterimText('');
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    finalTextRef.current = '';

    const recognition = createSpeechRecognition();
    if (!recognition) {
      setError('Bu tarayıcı ses tanımayı desteklemiyor.');
      return;
    }

    setIsStarting(true);
    try {
      if (!micGrantedRef.current) {
        const micAccess = await requestMicrophoneAccess();
        if (!micAccess.ok) {
          setError(micAccessErrorMessage(micAccess.reason));
          return;
        }
        micGrantedRef.current = true;
      }
    } finally {
      setIsStarting(false);
    }

    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = finalTextRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          final += (final ? ' ' : '') + transcript.trim();
        } else {
          interim += transcript;
        }
      }

      finalTextRef.current = final;
      setInterimText(interim);
      onInterim?.(interim);
    };

    recognition.onerror = (event: Event & { error: string }) => {
      const errMap: Record<string, string> = {
        'not-allowed': micGrantedRef.current
          ? 'Ses tanıma başlatılamadı. Sayfayı yenileyip tekrar deneyin.'
          : 'Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden mikrofonu açın.',
        'no-speech': 'Ses algılanamadı. Lütfen tekrar deneyin.',
        'audio-capture': 'Mikrofon bulunamadı veya erişilemiyor.',
        'network': 'Ağ hatası oluştu.',
        'aborted': '',
      };
      const msg = errMap[event.error] ?? `Hata: ${event.error}`;
      if (msg) setError(msg);
      if (event.error === 'not-allowed') {
        micGrantedRef.current = false;
      }
      setIsRecording(false);
      setInterimText('');
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
      if (finalTextRef.current.trim()) {
        onTranscript(finalTextRef.current.trim());
        finalTextRef.current = '';
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError('Ses kaydı başlatılamadı.');
      setIsRecording(false);
    }
  }, [onTranscript, onInterim]);

  const handleToggle = useCallback(() => {
    if (isRecording || isStarting) {
      if (isRecording) stopRecording();
      return;
    }
    void startRecording();
  }, [isRecording, isStarting, startRecording, stopRecording]);

  // Unmount'ta durdur
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Desteklenmiyor
  if (isSupported === false) {
    return (
      <button
        type="button"
        disabled
        title="Bu tarayıcı ses tanımayı desteklemiyor"
        className={`${SIZE_CLASSES[size]} flex items-center justify-center rounded-full bg-slate-100 text-slate-300 cursor-not-allowed flex-shrink-0 ${className}`}
      >
        <MicOffIcon className={ICON_SIZE[size]} />
      </button>
    );
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || isSupported === null || isStarting}
        title={isRecording ? 'Kaydı Durdur' : isStarting ? 'Mikrofon İzni İsteniyor…' : 'Sesli Not Ekle (Türkçe)'}
        className={[
          SIZE_CLASSES[size],
          'relative flex items-center justify-center rounded-full flex-shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1',
          isRecording
            ? 'bg-red-600 text-white focus:ring-red-400'
            : isStarting
              ? 'bg-blue-100 text-blue-600 focus:ring-blue-300'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:ring-slate-400',
          (disabled || isSupported === null || isStarting) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
          className,
        ].join(' ')}
        aria-label={isRecording ? 'Kaydı durdur' : 'Ses kaydı başlat'}
        aria-pressed={isRecording}
      >
        {/* Kayıt sırasında pulse halkası */}
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
            <span className="absolute inset-0 rounded-full bg-red-500 animate-pulse opacity-20" />
          </>
        )}
        {isRecording ? (
          <StopIcon className={`relative z-10 ${ICON_SIZE[size]}`} />
        ) : (
          <MicIcon className={`relative z-10 ${ICON_SIZE[size]}`} />
        )}
      </button>

      {/* Hata mesajı — textarea alt köşesinde olduğu için yukarıda göster */}
      {error && (
        <div className="absolute bottom-full mb-1.5 right-0 w-56 z-50">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 shadow-lg">
            <p className="text-xs text-red-700 text-left leading-snug">{error}</p>
          </div>
        </div>
      )}

      {/* Geçici transcript gösterimi */}
      {isRecording && interimText && (
        <div className="absolute bottom-full mb-1.5 right-0 w-64 z-50">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
            <p className="text-xs text-slate-400 italic text-center truncate">{interimText}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mikrofon ikonu ───────────────────────────────────────────────────────────
function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z" />
      <path d="M19 10a1 1 0 1 0-2 0 5 5 0 1 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 10z" />
    </svg>
  );
}

// ─── Dur ikonu ────────────────────────────────────────────────────────────────
function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

// ─── Mikrofon kapalı ikonu ────────────────────────────────────────────────────
function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
