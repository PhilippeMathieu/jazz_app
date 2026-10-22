// Petits éléments communs aux écrans du parcours.
import { useEffect, useState } from 'preact/hooks';
import { Days, loadDays, onEvent, streakOf, dayKey } from '../core/events';
import { lessonById } from '../modules/cours/lessons';
import { Next, Parcours, nextItem } from './progress';
import { STEPS, Step, Where } from './steps';

/** Adresse d'un élément du parcours. */
export const hrefOf = (n: Next | null) => (!n ? '#/' : n.kind === 'lesson' ? `#/lecon/${n.step.id}/${n.id}` : `#/x/${n.act.id}`);
export const pathOf = (n: Next | null) => hrefOf(n).slice(1);
export const nextPath = (p: Parcours, where?: Where) => pathOf(nextItem(p, where));

export const stepNo = (s: Step) => STEPS.indexOf(s) + 1;
export const lessonTitle = (id: string) => lessonById(id)?.title ?? id;
export const WHERE_LABEL: Record<Where, string> = { metro: 'Métro', piano: 'Piano' };

/** Le temps de pratique du jour, à jour après chaque réponse. */
export function useDays(): Days {
  const [d, setD] = useState(loadDays);
  useEffect(() => onEvent(() => setD(loadDays())), []);
  return d;
}

export function GoalRing({ done, goal, size = 52 }: { done: number; goal: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, done / goal);
  return (
    <svg class="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} class="ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} class={'ring-fg' + (p >= 1 ? ' full' : '')} stroke-dasharray={`${c * p} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle">
        {Math.floor(done)}
      </text>
    </svg>
  );
}

/** Objectif du jour et série, en une ligne. */
export function DayLine() {
  const d = useDays();
  const min = (d.days[dayKey()] ?? 0) / 60000;
  const st = streakOf(d);
  return (
    <a class="dayline" href="#/reglages">
      <GoalRing done={min} goal={d.goalMin} size={44} />
      <span>
        <b>
          {Math.floor(min)} / {d.goalMin} min aujourd’hui
        </b>
        <span class="muted small">{st.days ? `Série : ${st.days} jour${st.days > 1 ? 's' : ''} d’affilée` : 'Atteins l’objectif pour lancer une série'}</span>
      </span>
    </a>
  );
}

/** Coche, en cours, ou rien. */
export function Check({ state }: { state: 'done' | 'now' | 'todo' | 'assumed' }) {
  return <i class={'check ' + state} aria-hidden="true" />;
}
