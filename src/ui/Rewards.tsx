// Petits messages en haut de l'écran : exercice validé, étape terminée, objectif du jour atteint.
import { useEffect, useRef, useState } from 'preact/hooks';
import { now, piano } from '../core/audio/engine';

export interface Toast {
  kind: 'ok' | 'step' | 'goal';
  title: string;
  sub?: string;
}
const listeners = new Set<(t: Toast) => void>();
/** Affiche un message (et un petit carillon). */
export function toast(t: Toast) {
  listeners.forEach((f) => f(t));
}

function chime(kind: Toast['kind']) {
  const t = now() + 0.02;
  const notes = kind === 'step' ? [72, 76, 79, 84] : kind === 'goal' ? [79, 84] : [84];
  notes.forEach((m, i) => piano(m, t + i * 0.09, 0.5, 0.28));
}

export function Toasts() {
  const [list, setList] = useState<{ id: number; t: Toast }[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    const f = (t: Toast) => {
      const id = ++seq.current;
      setList((l) => [...l.slice(-2), { id, t }]);
      try {
        chime(t.kind);
      } catch {
        /* son indisponible */
      }
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3200);
    };
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  if (!list.length) return null;
  return (
    <div class="toasts" aria-live="polite">
      {list.map(({ id, t }) => (
        <div key={id} class={'toast ' + t.kind}>
          <b>{t.title}</b>
          {t.sub ? <span>{t.sub}</span> : null}
        </div>
      ))}
    </div>
  );
}
