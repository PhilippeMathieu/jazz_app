// Garde l'écran allumé pendant qu'on joue (téléphone posé sur le pupitre).
import { useEffect } from 'preact/hooks';

type Sentinel = { release: () => Promise<void>; addEventListener: (t: 'release', f: () => void) => void };
let sentinel: Sentinel | null = null;
let holders = 0;

async function acquire() {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } };
  if (sentinel || !nav.wakeLock || document.visibilityState !== 'visible') return;
  try {
    sentinel = await nav.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    // Refusé ou non pris en charge : l'écran suivra le réglage du téléphone.
  }
}

if (typeof document !== 'undefined') {
  // Le verrou tombe quand l'appli passe en arrière-plan : on le reprend au retour.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && holders > 0) void acquire();
  });
}

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    holders++;
    void acquire();
    return () => {
      holders = Math.max(0, holders - 1);
      if (holders === 0 && sentinel) {
        void sentinel.release();
        sentinel = null;
      }
    };
  }, [active]);
}
