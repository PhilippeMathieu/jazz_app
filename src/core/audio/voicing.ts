// Voicings de main gauche « sans fondamentale » (type Bill Evans) et conduite des voix.
import { Chord, QUALITIES, rootPc } from '../theory/chords';
import { mod } from '../theory/notes';

/** Intervalles joués au-dessus de la basse, par qualité (le bassiste joue la fondamentale). */
const UPPER: Record<string, number[]> = {
  maj: [0, 4, 7], maj7: [4, 7, 11, 14], '6': [4, 7, 9, 14], '69': [4, 7, 9, 14], maj9: [4, 7, 11, 14], 'maj7#11': [4, 11, 14, 18],
  min: [0, 3, 7], m7: [3, 7, 10, 14], m6: [3, 7, 9, 14], m9: [3, 7, 10, 14], m11: [3, 10, 14, 17], mM7: [3, 7, 11, 14],
  '7': [4, 9, 10, 14], '9': [4, 9, 10, 14], '13': [4, 9, 10, 14], '7b9': [4, 9, 10, 13], '7#9': [4, 10, 15, 20],
  '7#11': [4, 10, 14, 18], '7b13': [4, 10, 14, 20], '7alt': [4, 10, 15, 20], '7#5': [4, 8, 10, 14], '7b5': [4, 6, 10, 14],
  '7sus4': [5, 7, 10, 14], '9sus4': [5, 7, 10, 14], sus4: [0, 5, 7],
  m7b5: [3, 6, 10, 12], dim7: [0, 3, 6, 9], dim: [0, 3, 6], aug: [0, 4, 8]
};

const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

function closeVoicing(pcs: number[], start: number): number[] {
  const out: number[] = [];
  let cur = start - 1;
  for (const pc of pcs) {
    let m = cur + 1;
    while (mod(m, 12) !== pc) m++;
    out.push(m);
    cur = m;
  }
  return out;
}

/**
 * Choisit le renversement le plus proche du voicing précédent.
 * lo/hi : tessiture autorisée (MIDI).
 */
export function voiceLead(c: Chord, prev: number[] | null, lo = 50, hi = 74): number[] {
  const r = rootPc(c);
  const iv = UPPER[c.quality] ?? QUALITIES[c.quality].iv;
  const pcs = iv.map((i) => mod(r + i, 12));
  let best: { v: number[]; cost: number } | null = null;
  for (let k = 0; k < pcs.length; k++) {
    const rot = pcs.slice(k).concat(pcs.slice(0, k));
    for (let s = lo; s <= lo + 11; s++) {
      if (mod(s, 12) !== rot[0]) continue;
      const v = closeVoicing(rot, s);
      if (v[v.length - 1] > hi) continue;
      const cost = prev
        ? prev.length === v.length
          ? v.reduce((t, x, i) => t + Math.abs(x - prev[i]), 0)
          : Math.abs(avg(v) - avg(prev)) * v.length
        : Math.abs(avg(v) - (lo + hi) / 2);
      if (!best || cost < best.cost) best = { v, cost };
    }
  }
  return best ? best.v : pcs.map((p) => 60 + p);
}

/** Fondamentale à la basse dans la tessiture lo..lo+11. */
export const bassRoot = (c: Chord, lo = 36) => lo + mod(rootPc(c) - lo, 12);

/** Voicing complet pour illustrer un accord seul : basse + main gauche. */
export function displayVoicing(c: Chord): number[] {
  const b = bassRoot(c, 40);
  const up = voiceLead(c, null, 52, 76);
  return [b, ...up];
}
