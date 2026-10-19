// Chrono des exercices : compte à rebours (sprint) ou temps écoulé (série).
// Isolé pour se mettre à jour sans redessiner tout l'écran ; s'arrête pendant les explications.
import { useEffect, useState } from 'preact/hooks';

export const fmtSec = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';

export function Clock({
  limitMs,
  spent,
  qStart,
  paused,
  onTimeout
}: {
  /** Durée du sprint ; absent = chrono qui monte. */
  limitMs?: number;
  spent: { current: number };
  qStart: { current: number };
  paused: boolean;
  onTimeout: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      tick((t) => t + 1);
      if (limitMs && !paused && spent.current + performance.now() - qStart.current >= limitMs) onTimeout();
    }, 200);
    return () => clearInterval(id);
  }, [paused, limitMs]);
  const elapsed = spent.current + (paused ? 0 : performance.now() - qStart.current);
  if (!limitMs) return <span class="clock">{fmtSec(elapsed)}</span>;
  const remaining = Math.max(0, limitMs - elapsed);
  return (
    <span class="clock">
      {Math.ceil(remaining / 1000)} s
      <span class="timebar">
        <span style={`width:${(remaining / limitMs) * 100}%`} />
      </span>
    </span>
  );
}
