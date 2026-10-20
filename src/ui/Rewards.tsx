// Toasts de récompense (étoile, niveau ouvert, badge, défi, objectif, grade), avec un petit carillon.
import { useEffect, useRef, useState } from 'preact/hooks';
import { EXOS, Reward, loadGame, onReward } from '../core/game';
import { now, piano } from '../core/audio/engine';

const text = (r: Reward): [string, string] => {
  switch (r.kind) {
    case 'star':
      return ['★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), `${EXOS[r.exo]?.name ?? r.exo}, niveau ${r.level + 1}`];
    case 'unlock':
      return ['Niveau ouvert', `${EXOS[r.exo]?.name ?? r.exo} : niveau ${r.level + 1}`];
    case 'badge':
      return [`Badge : ${r.badge.name}`, r.badge.desc];
    case 'challenge':
      return ['Défi relevé', `${r.text} · +${r.xp} points`];
    case 'goal':
      return ['Objectif du jour atteint', '+50 points · la série continue'];
    case 'grade':
      return ['Nouveau grade', r.name];
  }
};

/** Quelques notes aiguës, très douces (désactivables dans Progression). */
function chime(kind: Reward['kind']) {
  const t = now() + 0.02;
  const notes = kind === 'grade' || kind === 'badge' ? [72, 76, 79, 84] : kind === 'star' ? [79, 84] : [84];
  notes.forEach((m, i) => piano(m, t + i * 0.09, 0.5, 0.28));
}

export function RewardToasts() {
  const [list, setList] = useState<{ id: number; r: Reward }[]>([]);
  const seq = useRef(0);
  useEffect(
    () =>
      onReward((r) => {
        const id = ++seq.current;
        setList((l) => [...l.slice(-2), { id, r }]);
        if (loadGame().fx) {
          try {
            chime(r.kind);
          } catch {
            /* son indisponible */
          }
        }
        setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3200);
      }),
    []
  );
  if (!list.length) return null;
  return (
    <div class="toasts" aria-live="polite">
      {list.map(({ id, r }) => {
        const [title, sub] = text(r);
        return (
          <div key={id} class={'toast ' + r.kind}>
            <b>{title}</b>
            <span>{sub}</span>
          </div>
        );
      })}
    </div>
  );
}
