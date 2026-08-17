'use client';

export type RunningLightsVariant = 'blue' | 'emerald' | 'slate';

export interface RunningLightsTextProps {
  text?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: RunningLightsVariant;
  /** Küçük LED noktaları (Cursor "running" hissi) */
  showLeds?: boolean;
}

const sizeClass: Record<NonNullable<RunningLightsTextProps['size']>, string> = {
  sm: 'running-lights--sm',
  md: 'running-lights--md',
  lg: 'running-lights--lg',
};

function joinClasses(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function RunningLightsText({
  text = 'Yükleniyor',
  className,
  size = 'md',
  variant = 'blue',
  showLeds = true,
}: RunningLightsTextProps) {
  const chars = Array.from(text);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={text}
      className={joinClasses('running-lights', sizeClass[size], `running-lights--${variant}`, className)}
    >
      {showLeds && (
        <span className="running-lights__leds" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="running-lights__led"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </span>
      )}
      <span className="running-lights__word" aria-hidden="true">
        {chars.map((char, index) => (
          <span
            key={`${char}-${index}`}
            className="running-lights__char"
            style={{ animationDelay: `${index * 0.11}s` }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </span>
    </span>
  );
}