/**
 * Eşzamanlı async işleri tek promise'te birleştirir.
 * Oturum refresh gibi tek-seferlik kritik işlemlerde çift çağrı / yarış önler.
 */
export type InFlightHolder<T> = { current: Promise<T> | null };

export function shareInFlight<T>(
  holder: InFlightHolder<T>,
  factory: () => Promise<T>,
): Promise<T> {
  if (holder.current) return holder.current;
  const started = factory().finally(() => {
    if (holder.current === started) holder.current = null;
  });
  holder.current = started;
  return started;
}
