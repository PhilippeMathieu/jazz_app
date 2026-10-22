// Attaques de l'élève : taps à l'écran ou notes au piano (micro), sur l'horloge audio.
import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../../core/audio/engine';
import { listenOnsets } from '../../core/listen/mic';

export type Input = 'tap' | 'mic';

/**
 * Instant d'un geste sur l'horloge audio, tel qu'on entend le son (latence de sortie comprise si le navigateur la donne).
 * Les horloges de certains téléphones sont incohérentes (horodatage du geste, ou de la sortie audio) : chaque correction
 * n'est gardée que si elle reste plausible ; sinon, l'horloge audio simple (le réglage du décalage compense le reste).
 */
export function eventTime(e: { timeStamp: number }): number {
  const ctx = audio();
  const perf = performance.now();
  const late = (perf - e.timeStamp) / 1000;
  const age = late > 0 && late < 0.2 ? late : 0;
  const base = ctx.currentTime - age;
  const ts = (ctx as AudioContext & { getOutputTimestamp?: () => AudioTimestamp }).getOutputTimestamp?.();
  if (ts && ts.performanceTime && ts.contextTime) {
    const t = ts.contextTime + (perf - ts.performanceTime) / 1000 - age;
    if (Math.abs(t - base) < 0.5) return t;
  }
  return base;
}

/**
 * Collecte des attaques tant que `active` est vrai. À l'écran, un toucher n'importe où compte (la grande zone ou
 * ailleurs), sauf sur un bouton ou un lien : on regarde le téléphone de loin, on ne vise pas.
 */
export function useHits(active: boolean, input: Input) {
  const hits = useRef<number[]>([]);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (input === 'mic')
      return listenOnsets((t) => {
        hits.current.push(t);
        setCount((c) => c + 1);
      });
    const f = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.('button:not(.tap-pad), a, input, select')) return;
      hits.current.push(eventTime(e));
      setCount((c) => c + 1);
    };
    window.addEventListener('pointerdown', f, { capture: true, passive: true });
    return () => window.removeEventListener('pointerdown', f, { capture: true });
  }, [active, input]);
  const reset = () => {
    hits.current = [];
    setCount(0);
  };
  return { hits, count, reset };
}
