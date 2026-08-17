/**
 * Çift kayıt / çift tıklama koruması (Dalga 1).
 * React state güncellenmeden önceki ikinci submit’i keser.
 */
export function createInFlightGuard() {
  let inFlight = false;
  return {
    /** true = işe başla; false = zaten devam eden işlem var */
    tryStart(): boolean {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    end(): void {
      inFlight = false;
    },
    get active() {
      return inFlight;
    },
  };
}
