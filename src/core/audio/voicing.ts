// Voicings : accompagnement du play-along et voicings de main gauche à apprendre.
import { Chord, QUALITIES, rootPc } from '../theory/chords';
import { mod } from '../theory/notes';

// ---------------------------------------------------------------- Accompagnement

/** Intervalles joués au-dessus de la basse, par qualité (le bassiste joue la fondamentale). */
const UPPER: Record<string, number[]> = {
  maj: [0, 4, 7], maj7: [4, 7, 11, 14], '6': [4, 7, 9, 14], '69': [4, 7, 9, 14], maj9: [4, 7, 11, 14], 'maj7#11': [4, 11, 14, 18],
  min: [0, 3, 7], m7: [3, 7, 10, 14], m6: [3, 7, 9, 14], m9: [3, 7, 10, 14], m11: [3, 10, 14, 17], mM7: [3, 7, 11, 14],
  '7': [4, 9, 10, 14], '9': [4, 9, 10, 14], '13': [4, 9, 10, 14], '7b9': [4, 8, 10, 13], '7b9b13': [4, 8, 10, 13], '7#9': [4, 10, 15, 20],
  '7#11': [4, 10, 14, 18], '7b13': [4, 8, 10, 14], '7alt': [4, 10, 15, 20], '7#5': [4, 8, 10, 14], '7b5': [4, 6, 10, 14],
  '7sus4': [5, 7, 10, 14], '9sus4': [5, 7, 10, 14], sus4: [0, 5, 7],
  m7b5: [3, 6, 10, 12], dim7: [0, 3, 6, 9], dim: [0, 3, 6], aug: [0, 4, 8]
};

/**
 * Couleur d'une dominante selon la gamme jouée dessus : l'accompagnement doit
 * sonner comme ce que l'appli conseille d'improviser.
 */
const DOMINANT_BY_SCALE: Record<string, number[]> = {
  mixolydien: [4, 9, 10, 14], // 3 13 ♭7 9
  mixob9b13: [4, 8, 10, 13], // 3 ♭13 ♭7 ♭9
  alteree: [4, 8, 10, 15], // 3 ♭13 ♭7 ♯9
  dimHW: [4, 9, 10, 13], // 3 13 ♭7 ♭9
  lydienb7: [4, 9, 10, 14],
  tons: [4, 8, 10, 14]
};

const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

/** Empile les classes de hauteur vers l'aigu à partir de `start`. */
export function closeVoicing(pcs: number[], start: number): number[] {
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
 * lo/hi : tessiture autorisée (MIDI). scale : gamme conseillée (colore les dominantes).
 */
export function voiceLead(c: Chord, prev: number[] | null, lo = 50, hi = 74, scale?: string): number[] {
  const r = rootPc(c);
  const isDom = QUALITIES[c.quality].family === 'dom' && !QUALITIES[c.quality].sus;
  const plain = ['7', '9', '13', '7b9'].includes(c.quality);
  const iv = (isDom && plain && scale && DOMINANT_BY_SCALE[scale]) || UPPER[c.quality] || QUALITIES[c.quality].iv;
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

/** Voicing complet pour illustrer un accord seul : basse + accord. */
export function displayVoicing(c: Chord, scale?: string): number[] {
  return [bassRoot(c, 40), ...voiceLead(c, null, 52, 76, scale)];
}

// ---------------------------------------------------------------- Main gauche (Flash voicings)

export type VoicingType = 'shell' | 'A' | 'B';
export const VOICING_LABEL: Record<VoicingType, string> = {
  shell: 'Fondamentale, 3ce, 7e',
  A: 'Sans fondamentale, 3ce en bas',
  B: 'Sans fondamentale, 7e en bas'
};

/** Voicing « A » sans fondamentale, en intervalles depuis la fondamentale (3ce en bas). */
const ROOTLESS_A: Record<string, number[]> = {
  maj7: [4, 7, 11, 14], maj9: [4, 7, 11, 14], '6': [4, 7, 9, 14], '69': [4, 7, 9, 14], 'maj7#11': [4, 6, 11, 14], maj: [4, 7, 11, 14],
  m7: [3, 7, 10, 14], m9: [3, 7, 10, 14], m11: [3, 5, 10, 14], min: [3, 7, 10, 14], m6: [3, 7, 9, 14], mM7: [3, 7, 11, 14],
  '7': [4, 9, 10, 14], '9': [4, 9, 10, 14], '13': [4, 9, 10, 14],
  // Dominante de cadence mineure : 3 ♭13 ♭7 ♭9 (G7 → Cm : B E♭ F A♭)
  '7b9': [4, 8, 10, 13], '7b9b13': [4, 8, 10, 13], '7#9': [4, 8, 10, 15], '7alt': [4, 8, 10, 15],
  '7#11': [4, 6, 10, 14], '7b13': [4, 8, 10, 14], '7#5': [4, 8, 10, 14], '7b5': [4, 6, 10, 14],
  '7sus4': [5, 7, 10, 14], '9sus4': [5, 7, 10, 14], sus4: [5, 7, 10, 14],
  m7b5: [3, 6, 10, 12], dim7: [3, 6, 9, 12], dim: [3, 6, 9, 12], aug: [4, 8, 10, 14]
};

const thirdOf = (iv: number[]) => (iv.includes(4) ? 4 : iv.includes(3) ? 3 : 5);
const seventhOf = (iv: number[]) => (iv.includes(10) ? 10 : iv.includes(11) ? 11 : iv.includes(9) ? 9 : 10);
const moveCost = (v: number[], prev: number[]) => v.reduce((s, x, i) => s + Math.abs(x - (prev[i] ?? x)), 0);

/** Notes MIDI du voicing de main gauche. prev : voicing précédent, pour bouger le moins possible. */
export function lhVoicing(c: Chord, type: VoicingType, prev: number[] | null = null): number[] {
  const r = rootPc(c);
  const iv = QUALITIES[c.quality].iv;
  if (type === 'shell') {
    const third = thirdOf(iv);
    const seventh = seventhOf(iv);
    const root = 40 + mod(r - 40, 12); // E2 à D♯3
    const close = [root, root + third, root + seventh];
    const open = [root, root + seventh, root + third + 12];
    // Sous A2, une tierce serrée sonne boueuse : 1-7-10.
    if (root < 45) return open;
    if (!prev) return close;
    return moveCost(open, prev) < moveCost(close, prev) ? open : close;
  }
  const a = ROOTLESS_A[c.quality] ?? [4, 7, 10, 14];
  const shape = type === 'A' ? a : [a[2] - 12, a[3] - 12, a[0], a[1]];
  const at = (low: number) => shape.map((x) => low + (x - shape[0]));
  const pc0 = mod(r + shape[0], 12);
  if (!prev) return at(48 + mod(pc0 - 48, 12)); // note grave entre C3 et B3
  // Avec un voicing précédent : l'octave qui bouge le moins, note grave entre B♭2 et D4.
  let best = at(48 + mod(pc0 - 48, 12));
  for (let low = 46; low <= 62; low++) {
    if (mod(low, 12) !== pc0) continue;
    const v = at(low);
    if (moveCost(v, prev) < moveCost(best, prev)) best = v;
  }
  return best;
}
