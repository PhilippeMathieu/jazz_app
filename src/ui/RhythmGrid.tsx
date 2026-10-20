// Un rythme en cases : une ligne par mesure, une case par croche (ou par triolet), le compte dessous.
import { useEffect, useRef, useState } from 'preact/hooks';
import { RPattern, TPB, gridOf } from '../core/rhythm/patterns';
import { audio, now } from '../core/audio/engine';
import { Take } from '../core/rhythm/play';

export type HitMark = 'ok' | 'early' | 'late' | 'miss';

/**
 * active : case de l'attaque qu'on entend (démonstration).
 * beat : temps en cours (0 = 1er temps du motif), toute la colonne s'éclaire.
 */
export function RhythmGrid({ p, marks = {}, small, active, beat }: { p: RPattern; marks?: Record<number, HitMark>; small?: boolean; active?: number | null; beat?: number | null }) {
  const cells = gridOf(p);
  const perBar = cells.length / p.bars;
  const rows = Array.from({ length: p.bars }, (_, b) => cells.slice(b * perBar, (b + 1) * perBar));
  return (
    <div class={'rgrid' + (small ? ' small' : '')} role="img" aria-label={`Rythme : ${p.name}`}>
      {rows.map((row, r) => (
        <div key={r} class="rgrid-bar" style={`grid-template-columns:repeat(${perBar}, minmax(0, 1fr))`}>
          {row.map((c) => (
            <div key={c.tick} class={'rcell' + (c.beat ? ' beat' : '') + (beat !== null && beat !== undefined && Math.floor(c.tick / TPB) === beat ? ' cur' : '')}>
              <span class={'rbox' + (c.on ? ' on' : '') + (marks[c.tick] ? ' ' + marks[c.tick] : '') + (active === c.tick ? ' now' : '')} />
              <span class="rlabel">{c.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Comment lire la grille, en une ligne. */
export function GridLegend() {
  return (
    <p class="muted small">
      Une case = un demi-temps. <b>Case pleine = un coup.</b> 1, 2, 3, 4 : les temps ; « et » : entre deux temps.
    </p>
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

export interface Clock {
  /** Décompte : 1 à 4, sinon null. */
  count: number | null;
  /** Temps en cours depuis le début (après le décompte), sinon null. */
  beat: number | null;
}

/**
 * Horloge visuelle d'une prise : décompte de 4 temps avant `start`, puis le numéro du temps en cours.
 * Calée sur ce qu'on entend (latence de sortie comprise quand le navigateur la donne).
 */
export function useBeatClock(): [Clock, (start: number, spb: number, beats: number) => void, () => void] {
  const [clock, setClock] = useState<Clock>({ count: null, beat: null });
  const raf = useRef(0);
  const last = useRef('');
  const stop = () => {
    cancelAnimationFrame(raf.current);
    last.current = '';
    setClock({ count: null, beat: null });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const run = (start: number, spb: number, beats: number) => {
    cancelAnimationFrame(raf.current);
    const lat = (audio() as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    const frame = () => {
      const t = now() - lat;
      let next: Clock = { count: null, beat: null };
      if (t >= start - 4 * spb && t < start) next = { count: Math.floor((t - (start - 4 * spb)) / spb) + 1, beat: null };
      else if (t >= start && t < start + beats * spb) next = { count: null, beat: Math.floor((t - start) / spb) };
      const key = `${next.count}-${next.beat}`;
      if (key !== last.current) {
        last.current = key;
        setClock(next);
      }
      if (t < start + beats * spb) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  };
  return [clock, run, stop];
}

/** « 1 2 3 4 » en grand pendant le décompte. */
export function CountIn({ count }: { count: number }) {
  return (
    <div class="countin" aria-live="polite">
      {[1, 2, 3, 4].map((n) => (
        <span key={n} class={n === count ? 'on' : n < count ? 'past' : ''}>
          {n}
        </span>
      ))}
    </div>
  );
}
