// Questions du module Oreille, sans interface (testables).
import { Chord, QUALITIES, chordOnPc, chordPcs, rootPc } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { PROGRESSIONS, keyFor, spellProgression } from '../../core/theory/progressions';
import { bassRoot, closeVoicing, lhVoicing, voiceLead } from '../../core/audio/voicing';
import { Rng, rndInt, shuffle, weightedPick } from '../../core/random';
import { PROG_LEVELS, QUALITY_LEVELS } from './data';
import { Pair, confusionWeight, rivalsOf } from '../../core/confusions';

export type EarMode = 'ear' | 'prog' | 'build';
export interface Played {
  chord: Chord;
  roman?: string;
  notes: number[];
}
export type EarQuestion =
  /** choices : seulement en duel (deux accords souvent confondus) ; sinon tout le niveau. */
  | { mode: 'ear'; q: string; c: Played; choices?: string[] }
  | { mode: 'build'; q: string; c: Played }
  | { mode: 'prog'; id: string; tonic: number; chords: Played[]; choices: string[] };

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

/** Poids d'un élément : ratés et confusions reviennent plus souvent, le dernier moins. */
const weight = (tally: Tally, k: string, item: string, pairs: Pair[], last?: string) => {
  const it = tally[k] ?? { c: 0, t: 0 };
  return (1 + 2 * (1 - (it.c + 1) / (it.t + 2))) * confusionWeight(pairs, item) * (item === last ? 0.3 : 1);
};

/** Une progression jouée dans la tonalité donnée (classe de hauteur de la tonique). */
export function progChords(id: string, tonic: number): Played[] {
  let prev: number[] | null = null;
  return spellProgression(keyFor(id, tonic), id).map(({ chord, roman }) => {
    const v = voiceLead(chord, prev, 52, 76);
    prev = v;
    return { chord, roman, notes: [bassRoot(chord, 40), ...v] };
  });
}

/** pairs : confusions de l'élève (accords ou progressions), pour personnaliser tirage et choix. */
export function makeEarQuestion(mode: EarMode, level: number, tally: Tally, last?: string, rng: Rng = Math.random, pairs: Pair[] = []): EarQuestion {
  if (mode === 'prog') {
    const id = weightedPick(PROG_LEVELS[level], (k) => weight(tally, 'prog:' + k, k, pairs, last), rng);
    const tonic = rndInt(12, rng);
    return { mode, id, tonic, chords: progChords(id, tonic), choices: progChoices(id, level, rng, rivalsOf(pairs, id)) };
  }
  const q = weightedPick(QUALITY_LEVELS[level], (k) => weight(tally, mode + ':' + k, k, mode === 'ear' ? pairs : [], last), rng);
  const c = chordOnPc(rndInt(12, rng), q);
  return { mode, q, c: { chord: c, notes: earVoicing(c, mode === 'ear' ? level : 1, rng) } };
}

/** Duel : une des paires que l'élève confond, et seulement ces deux réponses. */
export function makeDuelQuestion(mode: 'ear' | 'prog', pairs: Pair[], level: number, last?: string, rng: Rng = Math.random): EarQuestion | null {
  if (!pairs.length) return null;
  const p = weightedPick(pairs, (x) => Math.min(4, x.score) * (x.a === last || x.b === last ? 0.5 : 1), rng);
  const truth = rng() < 0.5 ? p.a : p.b;
  const choices = shuffle([p.a, p.b], rng);
  if (mode === 'prog') {
    const tonic = rndInt(12, rng);
    return { mode, id: truth, tonic, chords: progChords(truth, tonic), choices };
  }
  const c = chordOnPc(rndInt(12, rng), truth);
  return { mode, q: truth, c: { chord: c, notes: earVoicing(c, Math.max(1, level), rng) }, choices };
}

/**
 * Natures imposées (de 2 à 5), toujours les mêmes boutons dans le même ordre, sur une fondamentale au hasard.
 * Les ratées et les confusions reviennent plus souvent ; jamais plus de 3 fois de suite la même réponse.
 * level : la forme jouée (1 état fondamental, 3 renversements, 4 sans fondamentale).
 */
export function makeSetQuestion(set: string[], level: number, tally: Tally = {}, recent: string[] = [], pairs: Pair[] = [], rng: Rng = Math.random): EarQuestion {
  const run = recent.slice(-3);
  const banned = run.length === 3 && run.every((x) => x === run[0]) ? run[0] : null;
  const pool = set.filter((x) => x !== banned);
  // À deux réponses, pas de pénalité pour la dernière : sinon l'alternance se devine.
  const last = set.length > 2 ? recent[recent.length - 1] : undefined;
  const truth = weightedPick(pool, (k) => weight(tally, 'ear:' + k, k, pairs, last), rng);
  const c = chordOnPc(rndInt(12, rng), truth);
  return { mode: 'ear', q: truth, c: { chord: c, notes: earVoicing(c, Math.max(1, level), rng) }, choices: [...set] };
}

/**
 * Suites imposées (de 2 à 4), toujours les mêmes boutons dans le même ordre, dans une tonalité au hasard.
 * Les ratées et les confusions reviennent plus souvent ; jamais plus de 3 fois de suite la même réponse.
 */
export function makeProgSetQuestion(set: string[], tally: Tally = {}, recent: string[] = [], pairs: Pair[] = [], rng: Rng = Math.random): EarQuestion {
  const run = recent.slice(-3);
  const banned = run.length === 3 && run.every((x) => x === run[0]) ? run[0] : null;
  const pool = set.filter((x) => x !== banned);
  const last = set.length > 2 ? recent[recent.length - 1] : undefined;
  const id = weightedPick(pool, (k) => weight(tally, 'prog:' + k, k, pairs, last), rng);
  const tonic = rndInt(12, rng);
  return { mode: 'prog', id, tonic, chords: progChords(id, tonic), choices: [...set] };
}

/**
 * Choix pour « quelle progression ? » : seulement des progressions du même nombre d'accords,
 * pour que compter les accords ne suffise pas. D'abord celles du niveau, puis les voisines.
 */
export function progChoices(id: string, level: number, rng: Rng = Math.random, rivals: string[] = []): string[] {
  const n = PROGRESSIONS[id].steps.length;
  const same = (ids: string[]) => ids.filter((x) => x !== id && PROGRESSIONS[x].steps.length === n);
  const near = [level, level + 1, level - 1, level + 2].filter((l) => l >= 0 && l < PROG_LEVELS.length);
  // Les progressions que l'élève confond avec celle-ci d'abord.
  const ordered: string[] = same(rivals.filter((r) => PROGRESSIONS[r])).slice(0, 2);
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
