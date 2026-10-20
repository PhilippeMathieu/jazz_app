// Écouter un accord : plaqué, ou en arpège (note par note, de la plus grave à la plus aiguë),
// avec la note en cours allumée au clavier.
import { useEffect, useRef, useState } from 'preact/hooks';
import { audio, now, piano, playChord } from '../core/audio/engine';
import { Mark } from './Keyboard';
import { PlayIcon } from './icons';

const STEP = 0.24;

export function useListen() {
  const [active, setActive] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setActive(null);
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const chord = (notes: number[]) => {
    clear();
    audio();
    playChord(notes, now() + 0.03, 1.6, 0.55);
  };
  const arpeggio = (notes: number[]) => {
    clear();
    audio();
    const t0 = now() + 0.04;
    const up = [...notes].sort((a, b) => a - b);
    up.forEach((m, i) => {
      piano(m, t0 + i * STEP, 1.4, 0.55);
      timers.current.push(window.setTimeout(() => setActive(m), 40 + i * STEP * 1000));
    });
    timers.current.push(window.setTimeout(() => setActive(null), 40 + up.length * STEP * 1000 + 300));
  };
  return { active, chord, arpeggio };
}

/** La note de l'arpège en cours, mise en avant sur les marques du clavier. */
export const withActive = (marks: Record<number, Mark>, active: number | null) => (active === null ? marks : { ...marks, [active]: 'ok' as Mark });

export function ListenButtons({ notes, l, small }: { notes: number[]; l: ReturnType<typeof useListen>; small?: boolean }) {
  const cls = 'btn' + (small ? ' sm' : '');
  return (
    <span class="listen-btns">
      <button class={cls} disabled={!notes.length} onClick={() => l.chord(notes)}>
        <PlayIcon /> Accord
      </button>
      <button class={cls} disabled={!notes.length} onClick={() => l.arpeggio(notes)}>
        <PlayIcon /> Arpège
      </button>
    </span>
  );
}
