// L'état du jeu sur l'accueil : grade et points, objectif du jour, série, défis du jour.
import { useEffect, useState } from 'preact/hooks';
import { Challenge, GameState, dayKey, gameToday, gradeOf, onGameChange, streakOf } from '../core/game';
import { ChevronIcon } from './icons';

export function useGame(): GameState {
  const [g, setG] = useState(gameToday);
  useEffect(() => onGameChange(() => setG(gameToday())), []);
  return g;
}

const fmt = (n: number) => n.toLocaleString('fr-FR');

/** Anneau de l'objectif du jour. */
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

export function GameStrip({ g }: { g: GameState }) {
  const gr = gradeOf(g.xp);
  const today = g.days[dayKey()] ?? { xp: 0, ms: 0 };
  const min = today.ms / 60000;
  const st = streakOf(g);
  return (
    <a class="game-strip" href="#/progres">
      <GoalRing done={min} goal={g.goalMin} />
      <span class="gs-main">
        <span class="gs-grade">
          <b>{gr.name}</b> · {fmt(g.xp)} points
        </span>
        <span class="gs-bar">
          <i style={`width:${Math.round(gr.progress * 100)}%`} />
        </span>
        <span class="gs-sub">
          {min >= g.goalMin ? 'Objectif du jour atteint' : `${Math.floor(min)} / ${g.goalMin} min aujourd’hui`} · série : {st.days} jour{st.days > 1 ? 's' : ''}
          {gr.next ? ` · ${fmt(gr.toNext)} avant ${gr.next}` : ''}
        </span>
      </span>
      <ChevronIcon />
    </a>
  );
}

export function Challenges({ list, title = true }: { list: Challenge[]; title?: boolean }) {
  if (!list.length) return null;
  const done = list.filter((c) => c.done >= c.goal).length;
  return (
    <section>
      {title ? (
        <h2 class="label">
          Défis du jour · {done}/{list.length}
        </h2>
      ) : null}
      <div class="list">
        {list.map((c) => {
          const ok = c.done >= c.goal;
          return (
            <a key={c.id} class={'row challenge' + (ok ? ' done' : '')} href={c.href}>
              <span class="ch-check" aria-hidden="true">
                {ok ? '✓' : ''}
              </span>
              <span class="row-main">
                <span class="row-title">{c.text}</span>
                <span class="ch-bar">
                  <i style={`width:${Math.round((Math.min(c.done, c.goal) / c.goal) * 100)}%`} />
                </span>
              </span>
              <span class="ch-count">{ok ? '+60' : `${c.done}/${c.goal}`}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
