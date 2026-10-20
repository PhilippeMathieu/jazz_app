// Attaques de l'élève : taps à l'écran ou notes au piano (micro), sur l'horloge audio.
import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../../core/audio/engine';
import { listenOnsets } from '../../core/listen/mic';

export type Input = 'tap' | 'mic';

/** Instant d'un geste sur l'horloge audio, tel qu'on entend le son (latence de sortie comprise si le navigateur la donne). */
export function eventTime(e: { timeStamp: number }): number {
  const ctx = audio();
  const perf = performance.now();
  const age = Math.max(0, Math.min(0.2, (perf - e.timeStamp) / 1000));
  const ts = (ctx as AudioContext & { getOutputTimestamp?: () => AudioTimestamp }).getOutputTimestamp?.();
  if (ts && ts.performanceTime && ts.contextTime) return ts.contextTime + (perf - ts.performanceTime) / 1000 - age;
  return ctx.currentTime - age;
}

/** Collecte des attaques tant que `active` est vrai. */
export function useHits(active: boolean, input: Input) {
  const hits = useRef<number[]>([]);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active || input !== 'mic') return;
    return listenOnsets((t) => {
      hits.current.push(t);
      setCount((c) => c + 1);
    });
  }, [active, input]);
  const tap = (e: { timeStamp: number }) => {
    if (!active || input !== 'tap') return;
    hits.current.push(eventTime(e));
    setCount((c) => c + 1);
  };
  const reset = () => {
    hits.current = [];
    setCount(0);
  };
  return { hits, count, tap, reset };
}
