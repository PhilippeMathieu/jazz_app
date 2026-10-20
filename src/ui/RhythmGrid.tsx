// Un rythme en cases : une ligne par mesure, une case par croche (ou par triolet), le compte dessous.
import { useEffect, useRef, useState } from 'preact/hooks';
import { RPattern, gridOf } from '../core/rhythm/patterns';
import { now } from '../core/audio/engine';
import { Take } from '../core/rhythm/play';

export type HitMark = 'ok' | 'early' | 'late' | 'miss';

export function RhythmGrid({ p, marks = {}, small, active }: { p: RPattern; marks?: Record<number, HitMark>; small?: boolean; active?: number | null }) {
  const cells = gridOf(p);
  const perBar = cells.length / p.bars;
  const rows = Array.from({ length: p.bars }, (_, b) => cells.slice(b * perBar, (b + 1) * perBar));
  return (
    <div class={'rgrid' + (small ? ' small' : '')} role="img" aria-label={`Rythme : ${p.name}`}>
      {rows.map((row, r) => (
        <div key={r} class="rgrid-bar" style={`grid-template-columns:repeat(${perBar}, minmax(0, 1fr))`}>
          {row.map((c) => (
            <div key={c.tick} class={'rcell' + (c.beat ? ' beat' : '')}>
              <span class={'rbox' + (c.on ? ' on' : '') + (marks[c.tick] ? ' ' + marks[c.tick] : '') + (active === c.tick ? ' now' : '')} />
              <span class="rlabel">{c.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Suit la lecture d'un motif : la case de l'attaque en cours s'allume au moment où on l'entend. */
export function useCursor(): [number | null, (take: Take, p: RPattern) => void, () => void] {
  const [active, setActive] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setActive(null);
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const follow = (take: Take, p: RPattern) => {
    clear();
    const t0 = now();
    take.targets.forEach((t, i) => {
      const tick = p.hits[i % p.hits.length];
      timers.current.push(window.setTimeout(() => setActive(tick), (t - t0) * 1000));
    });
    timers.current.push(window.setTimeout(() => setActive(null), (take.end - t0) * 1000));
  };
  return [active, follow, clear];
}
