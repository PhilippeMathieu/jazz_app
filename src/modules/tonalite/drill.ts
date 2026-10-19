// Accords de la tonalité : une tonalité, une fondamentale, retrouver le type d'accord.
import { Key, Mode, keyLabel } from '../../core/chart/model';
import { Chord, chordSymbol } from '../../core/theory/chords';
import { Note, noteName, parseNote, pcOf, spellWith } from '../../core/theory/notes';
import { Rng, weightedPick } from '../../core/random';

export type DegQuality = 'maj7' | 'm7' | '7' | 'm7b5' | 'dim7';
export interface Degree {
  /** Demi-tons au-dessus de la tonique. */
  semis: number;
  /** Lettres au-dessus de la tonique (orthographe). */
  step: number;
  quality: DegQuality;
  roman: string;
}

/** Accords à quatre sons de la gamme majeure. */
export const MAJOR: Degree[] = [
  { semis: 0, step: 0, quality: 'maj7', roman: 'IΔ7' },
  { semis: 2, step: 1, quality: 'm7', roman: 'IIm7' },
  { semis: 4, step: 2, quality: 'm7', roman: 'IIIm7' },
  { semis: 5, step: 3, quality: 'maj7', roman: 'IVΔ7' },
  { semis: 7, step: 4, quality: '7', roman: 'V7' },
  { semis: 9, step: 5, quality: 'm7', roman: 'VIm7' },
  { semis: 11, step: 6, quality: 'm7b5', roman: 'VIIø7' }
];

/**
 * Mineur tel qu'on le joue en jazz : mineur naturel, plus le V7 et le VII°7 de l'harmonique
 * (la sensible). La fondamentale tranche toujours : en A mineur, G donne G7, G♯ donne G♯°7.
 */
export const MINOR: Degree[] = [
  { semis: 0, step: 0, quality: 'm7', roman: 'Im7' },
  { semis: 2, step: 1, quality: 'm7b5', roman: 'IIø7' },
  { semis: 3, step: 2, quality: 'maj7', roman: '♭IIIΔ7' },
  { semis: 5, step: 3, quality: 'm7', roman: 'IVm7' },
  { semis: 7, step: 4, quality: '7', roman: 'V7' },
  { semis: 8, step: 5, quality: 'maj7', roman: '♭VIΔ7' },
  { semis: 10, step: 6, quality: '7', roman: '♭VII7' },
  { semis: 11, step: 6, quality: 'dim7', roman: 'VII°7' }
];

export const degreesOf = (mode: Mode) => (mode === 'major' ? MAJOR : MINOR);

/** Réponses proposées, toujours dans le même ordre pour aller vite. */
export const CHOICES: { q: DegQuality; sym: string; name: string }[] = [
  { q: 'maj7', sym: 'maj7', name: 'majeur 7' },
  { q: 'm7', sym: 'm7', name: 'mineur 7' },
  { q: '7', sym: '7', name: 'dominante' },
  { q: 'm7b5', sym: 'ø7', name: 'demi-diminué' },
  { q: 'dim7', sym: '°7', name: 'diminué' }
];

const EASY_MAJOR = ['C', 'F', 'G', 'B♭', 'D', 'E♭', 'A'];
const ALL_MAJOR = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const ALL_MINOR = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
const key = (name: string, mode: Mode): Key => ({ tonic: parseNote(name)!.note, mode });

export const LEVELS = [
  { label: 'N1', desc: 'Majeur, 7 tonalités courantes (jusqu’à 3 altérations)' },
  { label: 'N2', desc: 'Majeur, les 12 tonalités' },
  { label: 'N3', desc: 'Mineur, les 12 tonalités (V7 et VII°7 de l’harmonique)' },
  { label: 'N4', desc: 'Majeur et mineur mélangés' }
];

export function keysFor(level: number): Key[] {
  if (level <= 1) return EASY_MAJOR.map((k) => key(k, 'major'));
  if (level === 2) return ALL_MAJOR.map((k) => key(k, 'major'));
  if (level === 3) return ALL_MINOR.map((k) => key(k, 'minor'));
  return [...ALL_MAJOR.map((k) => key(k, 'major')), ...ALL_MINOR.map((k) => key(k, 'minor'))];
}
/** Le °7 n'apparaît dans les réponses qu'à partir du mineur. */
export const choicesFor = (level: number) => (level >= 3 ? CHOICES : CHOICES.filter((c) => c.q !== 'dim7'));

/** Fondamentale du degré, bien orthographiée (F♯ en D, pas G♭). */
export function rootOf(k: Key, d: Degree): Note {
  return spellWith(k.tonic.letter + d.step, pcOf(k.tonic) + d.semis);
}
export const chordOf = (k: Key, d: Degree): Chord => ({ root: rootOf(k, d), quality: d.quality });

/** Les accords de la tonalité, dans l'ordre des degrés. */
export const harmonize = (k: Key) => degreesOf(k.mode).map((d) => ({ degree: d, chord: chordOf(k, d), symbol: chordSymbol(chordOf(k, d)) }));

export interface Question {
  id: string;
  key: Key;
  degree: Degree;
  root: Note;
  answer: DegQuality;
  explain: string;
}

export const itemId = (k: Key, d: Degree) => `${k.mode === 'major' ? 'M' : 'm'}:${noteName(k.tonic)}:${d.roman}`;

function explain(k: Key, d: Degree): string {
  const sym = chordSymbol(chordOf(k, d));
  const base = `${noteName(rootOf(k, d))} = degré ${d.roman.replace(/(Δ7|m7|7|ø7|°7)$/, '')} de ${keyLabel(k)} → ${sym}.`;
  if (k.mode === 'major') return base;
  if (d.roman === 'Im7') return `${base} En jazz, la tonique mineure se joue souvent m6 ou m(maj7).`;
  if (d.roman === 'V7') return `${base} En mineur, le V prend la sensible (mineur harmonique) : 7, pas m7.`;
  if (d.roman === 'VII°7') return `${base} La sensible, un demi-ton sous la tonique : °7 (mineur harmonique).`;
  if (d.roman === '♭VII7') return `${base} Un ton sous la tonique (mineur naturel) : 7.`;
  return base;
}

export type Tally = Record<string, { c: number; t: number }>;
/** Taux d'erreur lissé (jamais vu ≈ 25 %) → poids de 1 (toujours juste) à 9 (toujours faux). */
const weightOf = (tally: Tally, id: string) => {
  const it = tally[id] ?? { c: 0, t: 0 };
  return 1 + (8 * (it.t - it.c + 0.5)) / (it.t + 2);
};

/** Une question ; les couples tonalité-degré ratés reviennent plus souvent, jamais deux fois de suite. */
export function makeQuestion(level: number, tally: Tally = {}, rng: Rng = Math.random, prev?: string): Question {
  const items = keysFor(level)
    .flatMap((k) => degreesOf(k.mode).map((d) => ({ k, d, id: itemId(k, d) })))
    // pas de double altération (F𝄪 en G♯ mineur)
    .filter((x) => Math.abs(rootOf(x.k, x.d).acc) < 2 && x.id !== prev);
  const { k, d, id } = weightedPick(items, (x) => weightOf(tally, x.id), rng);
  return { id, key: k, degree: d, root: rootOf(k, d), answer: d.quality, explain: explain(k, d) };
}
