// Oreille › Intervalles : deux notes, trouver l'écart. Sans interface, testable.
import { Note, lettersFor, mod, noteName, spellWith } from '../../core/theory/notes';
import { Rng, pick, rndInt, shuffle, weightedPick } from '../../core/random';
import { Pair, confusionWeight } from '../../core/confusions';
import { Tally } from './questions';

export interface Interval {
  id: string;
  semis: number;
  /** Écart en lettres (C → E : 2), pour l'orthographe. */
  steps: number;
  name: string;
  short: string;
  /** Repère : le début d'un air connu, en montant. */
  song?: string;
  /** Où on le trouve dans les accords ; {a} = note grave, {b} = note aiguë. */
  jazz: string;
}

export const INTERVALS: Interval[] = [
  { id: '2m', semis: 1, steps: 1, name: 'seconde mineure', short: '2de m', song: 'Les Dents de la mer (début)', jazz: '{b} est la ♭9 de {a}7♭9 ; c’est aussi l’approche chromatique, la plus courante des notes de passage.' },
  { id: '2M', semis: 2, steps: 1, name: 'seconde majeure', short: '2de M', song: 'Frère Jacques (début)', jazz: '{b} est la 9e de {a}maj9 ; un pas de gamme.' },
  { id: '3m', semis: 3, steps: 2, name: 'tierce mineure', short: '3ce m', song: 'Greensleeves (début)', jazz: '{b} est la tierce de {a}m7 : la couleur mineure.' },
  { id: '3M', semis: 4, steps: 2, name: 'tierce majeure', short: '3ce M', song: 'Oh When the Saints (début)', jazz: '{b} est la tierce de {a}maj7 et de {a}7 : la couleur majeure.' },
  { id: '4', semis: 5, steps: 3, name: 'quarte juste', short: '4te', song: 'la Marche nuptiale de Wagner (début)', jazz: '{b} est la 11e de {a}m11 ; les voicings en quartes (So What) empilent cet intervalle.' },
  { id: 'tri', semis: 6, steps: 4, name: 'triton', short: 'triton', song: 'Maria, de West Side Story (début)', jazz: '{b} est la ♭5 de {a}ø7 ; c’est aussi l’écart entre la 3ce et la 7e de tout accord de dominante.' },
  { id: '5', semis: 7, steps: 4, name: 'quinte juste', short: '5te', song: 'Ah ! vous dirai-je, maman (do-do-sol)', jazz: '{b} est la quinte de {a} ; la contrebasse y va souvent au 3e temps.' },
  { id: '6m', semis: 8, steps: 5, name: 'sixte mineure', short: '6te m', song: 'The Entertainer de Scott Joplin (mi → do aigu)', jazz: '{b} est la ♭13 de {a}7♭13, une note altérée.' },
  { id: '6M', semis: 9, steps: 5, name: 'sixte majeure', short: '6te M', song: 'My Bonnie Lies over the Ocean (début)', jazz: '{b} est la 6te de {a}6 et la 13e de {a}13.' },
  { id: '7m', semis: 10, steps: 6, name: 'septième mineure', short: '7e m', song: 'Somewhere, de West Side Story (début)', jazz: '{b} est la 7e de {a}7 et de {a}m7.' },
  { id: '7M', semis: 11, steps: 6, name: 'septième majeure', short: '7e M', jazz: '{b} est la 7e de {a}maj7 : un demi-ton sous l’octave, tendue, elle veut monter.' },
  { id: '8', semis: 12, steps: 7, name: 'octave', short: 'octave', song: 'Over the Rainbow (début)', jazz: 'La même note, une octave plus haut.' }
];
export const intervalById = (id: string) => INTERVALS.find((x) => x.id === id);

export type IvDir = 'up' | 'down' | 'harm';
const ALL = INTERVALS.map((x) => x.id);
export const IV_LEVELS: { ids: string[]; dirs: IvDir[]; desc: string }[] = [
  { ids: ['3m', '3M', '4', '5', '8'], dirs: ['up'], desc: 'Débutant : 3ce m, 3ce M, 4te, 5te, octave, en montant' },
  { ids: ['2m', '2M', '3m', '3M', '4', '5', '6M', '7m', '8'], dirs: ['up'], desc: '+ 2de m, 2de M, 6te M, 7e m, en montant' },
  { ids: ALL, dirs: ['up'], desc: 'Les 12 intervalles (+ triton, 6te m, 7e M), en montant' },
  { ids: ALL, dirs: ['up', 'down'], desc: 'Les 12, en montant ou en descendant' },
  { ids: ALL, dirs: ['harm'], desc: 'Les 12, joués ensemble (comme dans un accord)' }
];

export interface IntervalQuestion {
  iv: Interval;
  dir: IvDir;
  low: number;
  high: number;
  a: Note;
  b: Note;
  /** Duel : deux réponses seulement. */
  choices?: string[];
}

/** Orthographe des deux notes : la note grave la plus simple qui donne une note aiguë sans double altération. */
export function spellPair(lowPc: number, iv: Interval): [Note, Note] {
  const odd = (n: Note) => (n.acc === 1 && (n.letter === 2 || n.letter === 6)) || (n.acc === -1 && (n.letter === 0 || n.letter === 3));
  let best: [Note, Note] | null = null;
  let cost = Infinity;
  for (const l of lettersFor(lowPc)) {
    const a = spellWith(l, lowPc);
    const b = spellWith(l + iv.steps, lowPc + iv.semis);
    // À coût égal, les bémols (plus courants en jazz).
    const c = Math.abs(a.acc) + Math.abs(b.acc) + (Math.abs(b.acc) >= 2 ? 10 : 0) + (odd(a) ? 3 : 0) + (odd(b) ? 2 : 0) + (a.acc > 0 ? 0.1 : 0);
    if (c < cost) {
      cost = c;
      best = [a, b];
    }
  }
  return best!;
}

const weight = (tally: Tally, id: string, pairs: Pair[], last?: string) => {
  const it = tally['iv:' + id] ?? { c: 0, t: 0 };
  return (1 + 2 * (1 - (it.c + 1) / (it.t + 2))) * confusionWeight(pairs, id) * (id === last ? 0.3 : 1);
};

function build(iv: Interval, dir: IvDir, rng: Rng): IntervalQuestion {
  // Note grave entre E3 et G4 : tout reste dans le médium du piano.
  const low = 52 + rndInt(16, rng);
  const [a, b] = spellPair(mod(low, 12), iv);
  return { iv, dir, low, high: low + iv.semis, a, b };
}

export function makeIntervalQuestion(level: number, tally: Tally, pairs: Pair[], last?: string, rng: Rng = Math.random): IntervalQuestion {
  const lv = IV_LEVELS[level] ?? IV_LEVELS[0];
  const id = weightedPick(lv.ids, (k) => weight(tally, k, pairs, last), rng);
  return build(intervalById(id)!, pick(lv.dirs, rng), rng);
}

/** Duel : une paire d'intervalles confondus, et seulement ces deux réponses. */
export function makeIntervalDuel(pairs: Pair[], level: number, last?: string, rng: Rng = Math.random): IntervalQuestion | null {
  const usable = pairs.filter((p) => intervalById(p.a) && intervalById(p.b));
  if (!usable.length) return null;
  const p = weightedPick(usable, (x) => Math.min(4, x.score) * (x.a === last || x.b === last ? 0.5 : 1), rng);
  const truth = rng() < 0.5 ? p.a : p.b;
  const lv = IV_LEVELS[level] ?? IV_LEVELS[0];
  return { ...build(intervalById(truth)!, pick(lv.dirs, rng), rng), choices: shuffle([p.a, p.b], rng) };
}

const DIR_TEXT: Record<IvDir, string> = { up: 'en montant', down: 'en descendant', harm: 'joués ensemble' };

/** Correction en mots : les deux notes, le sens, où on le trouve dans les accords, un repère. */
export function explainInterval(q: IntervalQuestion): string[] {
  const a = noteName(q.a);
  const b = noteName(q.b);
  const notes = q.dir === 'down' ? `${b} → ${a}` : q.dir === 'harm' ? `${a} et ${b}` : `${a} → ${b}`;
  const out = [`${notes}, ${DIR_TEXT[q.dir]} : ${q.iv.semis} demi-ton${q.iv.semis > 1 ? 's' : ''}.`, q.iv.jazz.replace(/\{a\}/g, a).replace(/\{b\}/g, b)];
  if (q.iv.song) out.push(`Repère, en montant : ${q.iv.song}.`);
  return out;
}

/** Ce qui sépare deux intervalles confondus. */
export function intervalDiff(x: string, y: string): string {
  const a = intervalById(x)!;
  const b = intervalById(y)!;
  const d = Math.abs(a.semis - b.semis);
  const [lo, hi] = a.semis < b.semis ? [a, b] : [b, a];
  return `${hi.short} = ${lo.short} + ${d} demi-ton${d > 1 ? 's' : ''} (${hi.semis} contre ${lo.semis}).`;
}
