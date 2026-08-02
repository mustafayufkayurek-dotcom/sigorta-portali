'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

type SpeechPhase = 'idle' | 'listening' | 'converting' | 'done';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface FieldSurveySpeechButtonProps {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export function FieldSurveySpeechButton({
  onTranscript,
  onError,
  disabled = false,
}: FieldSurveySpeechButtonProps) {
  const [phase, setPhase] = useState<SpeechPhase>('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalChunksRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const finishWithText = useCallback(() => {
    const text = finalChunksRef.current.join(' ').replace(/\s+/g, ' ').trim();
    finalChunksRef.current = [];
    if (text) {
      setPhase('converting');
      // Kısa UI geri bildirimi — ses kaydı saklanmaz
      window.setTimeout(() => {
        onTranscript(text);
        setPhase('done');
        window.setTimeout(() => setPhase('idle'), 900);
      }, 180);
    } else {
      setPhase('idle');
    }
  }, [onTranscript]);

  const toggle = () => {
    if (disabled) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError?.('Bu tarayıcıda sesli giriş desteklenmiyor. Chrome veya Edge deneyin.');
      return;
    }

    if (phase === 'listening') {
      try {
        recognitionRef.current?.stop();
      } catch {
        finishWithText();
      }
      return;
    }

    if (phase === 'converting') return;

    finalChunksRef.current = [];
    const recognition = new Ctor();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const chunks: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const row = event.results[i];
        if (row?.isFinal && row[0]?.transcript) {
          chunks.push(row[0].transcript.trim());
        }
      }
      if (chunks.length) finalChunksRef.current = chunks;
    };

    recognition.onerror = (event) => {
      const code = event.error ?? 'unknown';
      if (code === 'aborted' || code === 'no-speech') {
        setPhase('idle');
        return;
      }
      onError?.(
        code === 'not-allowed'
          ? 'Mikrofon izni verilmedi. Tarayıcı ayarlarından izin verin.'
          : 'Ses tanıma sırasında bir hata oluştu. Tekrar deneyin.',
      );
      setPhase('idle');
    };

    recognition.onend = () => {
      if (finalChunksRef.current.length) {
        finishWithText();
      } else {
        setPhase('idle');
      }
    };

    try {
      recognition.start();
      setPhase('listening');
    } catch {
      onError?.('Sesli giriş başlatılamadı.');
      setPhase('idle');
    }
  };

  const label =
    phase === 'listening'
      ? 'Dinleniyor…'
      : phase === 'converting'
        ? 'Dönüştürülüyor…'
        : phase === 'done'
          ? 'Tamamlandı'
          : 'Sesli Not';

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || phase === 'converting'}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
        phase === 'listening'
          ? 'bg-status-danger text-white hover:opacity-90'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      } disabled:opacity-50`}
      aria-pressed={phase === 'listening'}
      title="Keşif özetine sesli not ekle (metin olarak eklenir; ses kaydedilmez)"
    >
      <Mic className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
