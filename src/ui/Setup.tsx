// Écran de départ commun à tous les exercices : le but, l'exercice, le niveau, des options repliées, Commencer.
import { ComponentChildren } from 'preact';
import { Segmented } from './Segmented';

export interface LevelDef {
  /** Nom court facultatif (« Noires », « Shell »), affiché avant la description. */
  name?: string;
  desc: string;
}

/** « Niveau 3 », partout pareil (barre de jeu, records). */
export const levelName = (i: number) => `Niveau ${i + 1}`;
/** Version courte, pour la barre de jeu. */
export const levelShort = (i: number) => `Niv. ${i + 1}`;

/** Niveaux numérotés 1, 2, 3… (valeur = base + index) ; dessous, ce que contient le niveau choisi. */
export function LevelPicker({ levels, value, onChange, base = 0 }: { levels: LevelDef[]; value: number; onChange: (v: number) => void; base?: number }) {
  return (
    <Field label="Niveau">
      <Segmented
        label="Niveau"
        value={value}
        onChange={onChange}
        options={levels.map((l, i) => ({ value: i + base, label: String(i + 1), sub: l.name ? `${l.name} · ${l.desc}` : l.desc }))}
      />
    </Field>
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
