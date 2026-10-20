// Nommer ce qu'on joue : des notes (MIDI) → les accords possibles, du plus probable au moins probable.
import { Chord, QUALITIES, chordOnPc, chordSymbol, spellInChord } from './chords';
import { mod } from './notes';

export interface Reading {
  chord: Chord;
  /** « Cmaj7 », « C/E », « Cmaj9 » … */
  symbol: string;
  /** Précision : « 1er renversement », « sans quinte », « sans fondamentale ». */
  detail: string;
  score: number;
}

/** Qualités cherchées, avec un coût de « rareté » (les plus courantes d'abord). */
const CANDIDATES: [string, number][] = [
  ['maj', 0], ['min', 0], ['dim', 0.6], ['aug', 0.8], ['sus4', 0.8],
  ['maj7', 0.2], ['m7', 0.2], ['7', 0.2], ['m7b5', 0.4], ['dim7', 0.5],
  ['6', 0.5], ['m6', 0.5], ['mM7', 0.9], ['7sus4', 0.7],
  ['maj9', 1], ['m9', 1], ['9', 1], ['7b9', 1.1], ['7#9', 1.2], ['13', 1.3], ['69', 1.2],
  ['maj7#11', 1.4], ['7#11', 1.4], ['7b13', 1.5], ['7#5', 1.2], ['7b5', 1.3], ['m11', 1.4]
];

const same = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((x) => b.has(x));
const INVERSION = ['', '1er renversement', '2e renversement', '3e renversement'];

/** Intervalle entre deux notes, en mots (pour deux notes jouées). */
export function intervalName(a: number, b: number): string {
  const d = Math.abs(b - a);
  const names = ['unisson', 'seconde mineure', 'seconde majeure', 'tierce mineure', 'tierce majeure', 'quarte', 'triton', 'quinte', 'sixte mineure', 'sixte majeure', 'septième mineure', 'septième majeure'];
  const base = names[d % 12];
  return d >= 12 && d % 12 === 0 ? (d === 12 ? 'octave' : `${d / 12} octaves`) : d > 12 ? `${base} (+ octave)` : base;
}

/**
 * Lectures possibles d'un ensemble de notes. Une lecture exacte avec la fondamentale à la basse passe
 * devant ; viennent ensuite les renversements, les accords sans quinte et sans fondamentale.
 */
export function identify(midis: number[]): Reading[] {
  if (midis.length < 3) return [];
  const sorted = [...midis].sort((x, y) => x - y);
  const pcs = new Set(sorted.map((m) => mod(m, 12)));
  if (pcs.size < 3) return [];
  const bass = mod(sorted[0], 12);
  const out: Reading[] = [];
  for (let root = 0; root < 12; root++) {
    for (const [q, rarity] of CANDIDATES) {
      const iv = QUALITIES[q].iv;
      const full = new Set(iv.map((i) => mod(root + i, 12)));
      const noFifth = new Set([...full].filter((p) => p !== mod(root + 7, 12)));
      const noRoot = new Set([...full].filter((p) => p !== root));
      let detail = '';
      let cost = rarity;
      if (same(pcs, full)) detail = '';
      else if (iv.length >= 4 && iv.includes(7) && same(pcs, noFifth)) {
        detail = 'sans quinte';
        cost += 0.4;
      } else if (iv.length >= 4 && pcs.size >= 3 && same(pcs, noRoot)) {
        detail = 'sans fondamentale';
        cost += 1.5;
      } else continue;
      const chord = chordOnPc(root, q);
      let symbol = chordSymbol(chord);
      if (bass !== root && pcs.has(root)) {
        // Renversement : la note de basse est une note de l'accord.
        const order = iv.map((i) => mod(root + i, 12));
        const k = order.indexOf(bass);
        symbol += '/' + spellInChord(chord, bass);
        detail = [k > 0 && k <= 3 && iv.length <= 4 ? INVERSION[k] : 'basse ' + spellInChord(chord, bass), detail].filter(Boolean).join(', ');
        cost += 0.6;
      } else if (bass !== root) cost += 0.3; // sans fondamentale : la basse n'est pas la fondamentale, c'est normal
      out.push({ chord, symbol, detail, score: cost });
    }
  }
  return out.sort((a, b) => a.score - b.score).filter((r, i, arr) => arr.findIndex((x) => x.symbol === r.symbol) === i);
}
