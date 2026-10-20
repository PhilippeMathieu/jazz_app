// Questions du module Oreille, sans interface (testables).
import { Chord, QUALITIES, chordOnPc, chordPcs, rootPc } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { PROGRESSIONS, keyFor, spellProgression } from '../../core/theory/progressions';
import { bassRoot, closeVoicing, lhVoicing, voiceLead } from '../../core/audio/voicing';
import { Rng, rndInt, shuffle, weightedPick } from '../../core/random';
import { PROG_LEVELS, QUALITY_LEVELS } from './data';

export type EarMode = 'ear' | 'prog' | 'build';
export interface Played {
  chord: Chord;
  roman?: string;
  notes: number[];
}
export type EarQuestion =
  | { mode: 'ear'; q: string; c: Played }
  | { mode: 'build'; q: string; c: Played }
  | { mode: 'prog'; id: string; chords: Played[]; choices: string[] };

export type Tally = Record<string, { c: number; t: number }>;

/**
 * Voicing joué pour reconnaître une qualité d'accord. Plus le niveau monte, moins la forme est scolaire :
 * N1–N2 état fondamental serré, N3 renversements, N4 sans fondamentale (A ou B) au-dessus de la basse.
 */
export function earVoicing(c: Chord, level: number, rng: Rng = Math.random): number[] {
  const r = rootPc(c);
  const b = bassRoot(c, 40);
  if (level >= 4) return [b, ...lhVoicing(c, rng() < 0.5 ? 'A' : 'B').map((m) => m + 12)];
  let iv = QUALITIES[c.quality].iv;
  if (c.quality === '13') iv = [0, 4, 10, 14, 21];
  const upper = (iv.length >= 5 ? iv.slice(1) : iv).map((i) => mod(r + i, 12));
  const rot = level >= 3 ? rndInt(upper.length, rng) : 0;
  const pcs = upper.slice(rot).concat(upper.slice(0, rot));
  return [b, ...closeVoicing(pcs, b + 12)];
}

const weight = (tally: Tally, k: string, last?: string) => {
  const it = tally[k] ?? { c: 0, t: 0 };
  return (1 + 2 * (1 - (it.c + 1) / (it.t + 2))) * (k === last ? 0.3 : 1);
};

export function makeEarQuestion(mode: EarMode, level: number, tally: Tally, last?: string, rng: Rng = Math.random): EarQuestion {
  if (mode === 'prog') {
    const id = weightedPick(PROG_LEVELS[level], (k) => weight(tally, 'prog:' + k, last), rng);
    let prev: number[] | null = null;
    const chords = spellProgression(keyFor(id, rndInt(12, rng)), id).map(({ chord, roman }) => {
      const v = voiceLead(chord, prev, 52, 76);
      prev = v;
      return { chord, roman, notes: [bassRoot(chord, 40), ...v] };
    });
    return { mode, id, chords, choices: progChoices(id, level, rng) };
  }
  const q = weightedPick(QUALITY_LEVELS[level], (k) => weight(tally, mode + ':' + k, last), rng);
  const c = chordOnPc(rndInt(12, rng), q);
  return { mode, q, c: { chord: c, notes: earVoicing(c, mode === 'ear' ? level : 1, rng) } };
}

/**
 * Choix pour « quelle progression ? » : seulement des progressions du même nombre d'accords,
 * pour que compter les accords ne suffise pas. D'abord celles du niveau, puis les voisines.
 */
export function progChoices(id: string, level: number, rng: Rng = Math.random): string[] {
  const n = PROGRESSIONS[id].steps.length;
  const same = (ids: string[]) => ids.filter((x) => x !== id && PROGRESSIONS[x].steps.length === n);
  const near = [level, level + 1, level - 1, level + 2].filter((l) => l >= 0 && l < PROG_LEVELS.length);
  const ordered: string[] = [];
  for (const l of near) for (const x of shuffle(same(PROG_LEVELS[l]), rng)) if (!ordered.includes(x)) ordered.push(x);
  return shuffle([id, ...ordered.slice(0, 3)], rng);
}

export interface BuildCheck {
  ok: boolean;
  missing: number[];
  extra: number[];
}

/** Accord construit au clavier : classes de hauteur, octave libre. La quinte est facultative sur les accords enrichis. */
export function checkBuild(c: Chord, played: number[]): BuildCheck {
  const iv = QUALITIES[c.quality].iv;
  const r = rootPc(c);
  const optionalFifth = iv.length >= 5 || c.quality === '13';
  const required = chordPcs(c).filter((p) => !(optionalFifth && p === mod(r + 7, 12)));
  const allowed = new Set(chordPcs(c));
  const got = new Set(played.map((m) => mod(m, 12)));
  const missing = required.filter((p) => !got.has(p));
  const extra = [...got].filter((p) => !allowed.has(p));
  return { ok: !missing.length && !extra.length, missing, extra };
}
