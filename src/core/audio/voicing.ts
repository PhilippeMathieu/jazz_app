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

// ---------------------------------------------------------------- Main gauche (exercice Voicings)

export type VoicingType = 'triad' | 'shell' | 'A' | 'B' | 'spread' | 'quartal' | 'drop2' | 'us';
export const VOICING_LABEL: Record<VoicingType, string> = {
  triad: 'Fondamentale, 3ce, 5te, renversement libre',
  shell: 'Fondamentale, 3ce, 7e',
  A: 'Sans fondamentale, 3ce en bas',
  B: 'Sans fondamentale, 7e en bas',
  spread: 'Deux mains : MG 1 et 7, MD 3, 5 ou 13, 9',
  quartal: 'Deux mains, en quartes (So What sur les m7)',
  drop2: 'Deux mains : accord serré, la 2e voix depuis le haut descendue d’une octave à la MG',
  us: 'Deux mains, dominantes : MG 3 et 7, MD une triade majeure (upper structure)'
};
/** Voicings à deux mains (le reste se joue à la main gauche). */
export const TWO_HANDS: VoicingType[] = ['spread', 'quartal', 'drop2', 'us'];

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
  if (TWO_HANDS.includes(type)) return twoHands(c, type, prev).notes;
  const r = rootPc(c);
  const iv = QUALITIES[c.quality].iv;
  if (type === 'triad') {
    // 3 sons serrés : état fondamental au départ, puis le renversement le plus proche.
    const pcs = iv.slice(0, 3).map((x) => mod(r + x, 12));
    if (!prev) return closeVoicing(pcs, 53 + mod(r - 53, 12));
    const center = prev.reduce((a, b) => a + b, 0) / prev.length;
    let best: number[] | null = null;
    for (let rot = 0; rot < 3; rot++) {
      const order = pcs.slice(rot).concat(pcs.slice(0, rot));
      for (let low = 50; low <= 64; low++) {
        if (mod(low, 12) !== order[0]) continue;
        const v = closeVoicing(order, low);
        if (v[0] !== low) continue;
        const d = Math.abs(v.reduce((a, b) => a + b, 0) / 3 - center);
        if (!best || d < Math.abs(best.reduce((a, b) => a + b, 0) / 3 - center)) best = v;
      }
    }
    return best ?? closeVoicing(pcs, 53 + mod(r - 53, 12));
  }
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

// ---------------------------------------------------------------- Deux mains

/** Notes du voicing (graves → aiguës) ; les `lh` premières à la main gauche. */
export interface TwoHands {
  notes: number[];
  lh: number;
}

export type UsId = 'II' | 'VI' | 'bVI' | 'bIII' | 'bV';
/**
 * Upper structures : une triade majeure à la main droite sur 3 et 7 de la dominante (main gauche).
 * semis/letters : fondamentale de la triade au-dessus de celle de l'accord ; quality : accord écrit.
 */
export const UPPER_STRUCTURES: Record<UsId, { semis: number; letters: number; name: string; quality: string; suffix: string; tensions: string }> = {
  II: { semis: 2, letters: 1, name: 'II', quality: '7#11', suffix: '13(♯11)', tensions: '9, ♯11, 13' },
  VI: { semis: 9, letters: 5, name: 'VI', quality: '7b9', suffix: '13(♭9)', tensions: '13, ♭9, 3' },
  bVI: { semis: 8, letters: 5, name: '♭VI', quality: '7alt', suffix: '7(♯9 ♭13)', tensions: '♭13, 1, ♯9' },
  bIII: { semis: 3, letters: 2, name: '♭III', quality: '7#9', suffix: '7(♯9)', tensions: '♯9, 5, ♭7' },
  bV: { semis: 6, letters: 4, name: '♭V', quality: '7b9', suffix: '7(♭9 ♯11)', tensions: '♯11, ♭7, ♭9' }
};
export const US_IDS = Object.keys(UPPER_STRUCTURES) as UsId[];

/** Deux mains « écartées » : [main gauche, main droite], en intervalles depuis la fondamentale. */
function spreadShape(q: string): [number[], number[]] {
  const iv = QUALITIES[q].iv;
  const fam = QUALITIES[q].family;
  if (QUALITIES[q].sus) return [[0, 10], [17, 21, 26]];
  if (fam === 'maj') {
    const top = iv.includes(11) ? 11 : 9;
    return q === 'maj7#11' ? [[0, 11], [16, 18, 21]] : [[0, top], [16, 19, 26]];
  }
  if (fam === 'min') return [[0, iv.includes(11) ? 11 : iv.includes(10) ? 10 : 9], [15, 19, 26]];
  if (fam === 'hdim') return [[0, 10], [15, 18, 24]];
  if (fam === 'dim') return [[0, 9], [15, 18, 26]];
  if (fam === 'dom') {
    const rh: Record<string, number[]> = {
      '7b9': [16, 21, 25], '7b9b13': [16, 20, 25], '7alt': [16, 20, 27], '7#9': [16, 19, 27],
      '7#11': [16, 18, 21, 26], '7b13': [16, 20, 26], '7#5': [16, 20, 26], '7b5': [16, 18, 26]
    };
    return [[0, 10], rh[q] ?? [16, 21, 26]];
  }
  return [[0], iv.filter((x) => x > 0).map((x) => x + 12)];
}

/** Voicing en quartes (intervalles depuis la fondamentale) et nombre de notes à la main gauche. */
function quartalShape(q: string): [number[], number] | null {
  const fam = QUALITIES[q].family;
  if (QUALITIES[q].sus) return [[7, 12, 17, 22, 26], 3]; // So What depuis la quinte : 5 1 4 ♭7 9
  if (['m7', 'm9', 'm11', 'min'].includes(q)) return [[0, 5, 10, 15, 19], 3]; // So What : 1 4 ♭7 ♭3 5
  if (q === 'm6') return [[3, 9, 14, 19], 2];
  if (q === '6' || q === '69') return [[4, 9, 14, 19], 2]; // 3 6 9 5
  if (fam === 'maj') return [[11, 16, 21, 26], 2]; // 7 3 6 9
  if (fam === 'hdim') return [[0, 5, 10, 15, 18], 3];
  if (fam === 'dom') {
    const m: Record<string, number[]> = { '7b9': [10, 16, 21, 25], '7b9b13': [10, 16, 20, 25], '7alt': [4, 10, 15, 20], '7#9': [4, 10, 15, 20], '7#11': [6, 10, 16, 21] };
    return [m[q] ?? [10, 16, 21, 26], 2]; // ♭7 3 13 9
  }
  return null;
}

const center = (v: number[]) => avg(v);
const closest = (cands: number[][], prev: number[] | null, target: number) =>
  cands.reduce((best, v) => {
    const cost = (x: number[]) => (prev ? (prev.length === x.length ? moveCost(x, prev) : Math.abs(center(x) - center(prev)) * x.length) : Math.abs(center(x) - target));
    return !best || cost(v) < cost(best) ? v : best;
  }, null as number[] | null)!;

/** Voicing à deux mains. us : la triade du haut pour les upper structures (II par défaut). */
export function twoHands(c: Chord, type: VoicingType, prev: number[] | null = null, us: UsId = 'II'): TwoHands {
  const r = rootPc(c);
  if (type === 'quartal') {
    const qs = quartalShape(c.quality);
    if (qs) {
      const [shape, lh] = qs;
      const cands: number[][] = [];
      for (let low = 45; low <= 57; low++) if (mod(low, 12) === mod(r + shape[0], 12)) cands.push(shape.map((x) => low + x - shape[0]));
      return { notes: closest(cands, prev, 62), lh };
    }
    type = 'spread';
  }
  if (type === 'drop2') {
    const iv = QUALITIES[c.quality].iv.filter((x) => x < 12);
    if (iv.length >= 4) {
      const tones = (iv.length > 4 ? [iv[0], iv[1], iv[2], iv[3]] : iv).map((x) => mod(r + x, 12));
      const cands: number[][] = [];
      for (let k = 0; k < 4; k++) {
        const rot = tones.slice(k).concat(tones.slice(0, k));
        for (let s = 55; s <= 70; s++) {
          if (mod(s, 12) !== rot[0]) continue;
          const v = closeVoicing(rot, s);
          if (v[3] < 67 || v[3] > 79) continue;
          cands.push([v[2] - 12, v[0], v[1], v[3]]);
        }
      }
      if (cands.length) return { notes: closest(cands, prev, 64), lh: 1 };
    }
    type = 'spread';
  }
  if (type === 'us' && QUALITIES[c.quality].family === 'dom' && !QUALITIES[c.quality].sus) {
    const u = UPPER_STRUCTURES[us];
    const triad = [0, 4, 7].map((x) => mod(r + u.semis + x, 12));
    const cands: number[][] = [];
    for (const lhShape of [[4, 10], [10, 16]]) {
      for (let low = 50; low <= 61; low++) {
        if (mod(low, 12) !== mod(r + lhShape[0], 12)) continue;
        const lh = lhShape.map((x) => low + x - lhShape[0]);
        for (let k = 0; k < 3; k++) {
          const rot = triad.slice(k).concat(triad.slice(0, k));
          let s = lh[1] + 1;
          while (mod(s, 12) !== rot[0]) s++;
          const rh = closeVoicing(rot, s);
          if (rh[2] <= 81) cands.push([...lh, ...rh]);
        }
      }
    }
    return { notes: closest(cands, prev, 64), lh: 2 };
  }
  // Écartés (et repli des autres) : fondamentale entre C2 et E3.
  const [lhIv, rhIv] = spreadShape(c.quality);
  const cands: number[][] = [];
  for (let root = 36; root <= 52; root++) if (mod(root, 12) === r) cands.push([...lhIv, ...rhIv].map((x) => root + x));
  const v = closest(
    cands.filter((x) => x[x.length - 1] <= 81),
    prev,
    60
  );
  return { notes: v, lh: lhIv.length };
}
