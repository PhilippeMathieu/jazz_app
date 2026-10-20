// Écran de départ commun à tous les exercices : le but, l'exercice, le niveau, des options repliées, Commencer.
import { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Segmented } from './Segmented';
import { loadGame, unlock, unlockedMax } from '../core/game';

export interface LevelDef {
  /** Nom court facultatif (« Noires », « Shell »), affiché avant la description. */
  name?: string;
  desc: string;
}

/** « Niveau 3 », partout pareil (barre de jeu, records). */
export const levelName = (i: number) => `Niveau ${i + 1}`;
/** Version courte, pour la barre de jeu. */
export const levelShort = (i: number) => `Niv. ${i + 1}`;

/**
 * Niveaux numérotés 1, 2, 3… (valeur = base + index) ; dessous, ce que contient le niveau choisi.
 * exo : les étoiles gagnées à chaque niveau, et les niveaux encore fermés (une étoile au précédent les ouvre).
 */
export function LevelPicker({ levels, value, onChange, base = 0, exo }: { levels: LevelDef[]; value: number; onChange: (v: number) => void; base?: number; exo?: string }) {
  const [asked, setAsked] = useState<number | null>(null);
  const [, refresh] = useState(0);
  const sub = (l: LevelDef) => (l.name ? `${l.name} · ${l.desc}` : l.desc);
  if (!exo)
    return (
      <Field label="Niveau">
        <Segmented label="Niveau" value={value} onChange={onChange} options={levels.map((l, i) => ({ value: i + base, label: String(i + 1), sub: sub(l) }))} />
      </Field>
    );
  const g = loadGame();
  const open = unlockedMax(exo, value - base);
  const cur = levels[value - base];
  return (
    <Field label="Niveau">
      <div class="seg-wrap">
        <div class="seg levels" role="radiogroup" aria-label="Niveau">
          {levels.map((_, i) => {
            const s = g.stars[`${exo}:${i}`] ?? 0;
            const locked = i > open;
            return (
              <button
                key={i}
                role="radio"
                aria-checked={value === i + base}
                class={locked ? 'locked' : ''}
                aria-label={`Niveau ${i + 1}${locked ? ', fermé' : `, ${s} étoile${s > 1 ? 's' : ''}`}`}
                onClick={() => {
                  setAsked(locked ? i : null);
                  if (!locked) onChange(i + base);
                }}
              >
                <span class="seg-label">{i + 1}</span>
                <span class="lv-stars">{locked ? <LockIcon /> : <Stars n={s} />}</span>
              </button>
            );
          })}
        </div>
        {asked !== null ? (
          <p class="seg-detail">
            Niveau {asked + 1} fermé : obtiens une étoile au niveau {asked} (80 % sur 20 réponses).{' '}
            <button
              class="linkbtn inline"
              onClick={() => {
                unlock(exo, asked);
                setAsked(null);
                refresh((x) => x + 1);
                onChange(asked + base);
              }}
            >
              Ouvrir quand même
            </button>
          </p>
        ) : cur ? (
          <p class="seg-detail">{sub(cur)}</p>
        ) : null}
      </div>
    </Field>
  );
}

/** ★★☆ : étoiles gagnées en couleur, les autres en creux. */
export function Stars({ n }: { n: number }) {
  return (
    <>
      <span class="st-on">{'★'.repeat(n)}</span>
      <span class="st-off">{'☆'.repeat(3 - n)}</span>
    </>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <path d="M7 10V8a5 5 0 0 1 10 0v2h1v11H6V10zm2 0h6V8a3 3 0 0 0-6 0z" fill="currentColor" />
    </svg>
  );
}

/** Un réglage avec son titre. */
export function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="field-block">
      <h2 class="label">{label}</h2>
      {children}
    </div>
  );
}

/** Options secondaires, repliées par défaut ; le résumé dit ce qui est réglé. */
export function MoreOptions({ summary, children }: { summary: string; children: ComponentChildren }) {
  return (
    <details class="opts">
      <summary>
        <span class="opts-title">Options</span>
        <span class="opts-sum">{summary}</span>
      </summary>
      <div class="opts-body">{children}</div>
    </details>
  );
}

export function StartButton({ onClick, label = 'Commencer', disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button class="btn primary block" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

export type RoundMode = 'sprint' | 'serie';

/** Option commune aux exercices chronométrés : sprint de 60 s ou série de n questions. */
export function SprintOptions({ mode, n, what, onChange }: { mode: RoundMode; n: number; what: string; onChange: (m: RoundMode) => void }) {
  return (
    <MoreOptions summary={mode === 'sprint' ? 'Sprint de 60 s' : `Série de ${n} ${what}`}>
      <Field label="Format">
        <Segmented
          label="Format"
          value={mode}
          onChange={onChange}
          options={[
            { value: 'sprint', label: 'Sprint 60 s', sub: `Le plus de ${what} justes en 60 secondes.` },
            { value: 'serie', label: `${n} ${what}`, sub: `${n} ${what}, chronométrées : le temps total compte.` }
          ]}
        />
      </Field>
    </MoreOptions>
  );
}
