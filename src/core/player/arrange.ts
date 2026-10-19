// Arrangement d'un chorus (basse walking, comping, batterie), sans audio : testable.
import { Chart, FlatChord } from '../chart/model';
import { Chord, QUALITIES, rootPc } from '../theory/chords';
import { mod, pcOf } from '../theory/notes';
import { voiceLead } from '../audio/voicing';
import { Rng, pick } from '../random';

export interface ArrangeOptions {
  bass: boolean;
  comp: boolean;
  drums: boolean;
}
export type ArrEvent =
  /** Début de temps (pour l'affichage). */
  | { beat: number; kind: 'pos'; bar: number; chord: number; beatInBar: number }
  | { beat: number; kind: 'bass'; midi: number; dur: number; vel: number }
  | { beat: number; kind: 'chord'; notes: number[]; dur: number; vel: number }
  | { beat: number; kind: 'ride' | 'hat'; vel: number };

/** Ce qui se prolonge d'un chorus à l'autre (conduite des voix). */
export interface ArrangeState {
  prevBass: number;
  prevVoicing: number[] | null;
}
export const newArrangeState = (): ArrangeState => ({ prevBass: 40, prevVoicing: null });

const SWING = 2 / 3;
export const BASS_LO = 31;
export const BASS_HI = 52;

const bassPc = (c: Chord) => (c.bass ? pcOf(c.bass) : rootPc(c));
/** Note de hauteur `pc` la plus proche de `near`, dans la tessiture lo..hi. */
function nearest(pc: number, near: number, lo = BASS_LO, hi = BASS_HI) {
  let best = -1;
  for (let m = lo; m <= hi; m++) if (mod(m, 12) === pc && (best < 0 || Math.abs(m - near) < Math.abs(best - near))) best = m;
  return best;
}
const chordTones = (c: Chord) => QUALITIES[c.quality].iv.filter((i) => i < 12).map((i) => mod(rootPc(c) + i, 12));

function walkingLine(c: FlatChord, nextC: Chord, prevNote: number, first: boolean, rng: Rng): number[] {
  const tones = chordTones(c.chord);
  const third = tones[1];
  const fifth = tones[2] ?? tones[1];
  const root = first || rng() < 0.8 ? nearest(bassPc(c.chord), prevNote, 33, 48) : nearest(fifth, prevNote, 33, 48);
  const target = nearest(bassPc(nextC), root);
  const below = target - 1 >= BASS_LO ? target - 1 : target + 1;
  const above = target + 1 <= BASS_HI ? target + 1 : target - 1;
  const approach = () => pick([below, above, below, above, target + 7 <= BASS_HI ? target + 7 : target - 5 >= BASS_LO ? target - 5 : below], rng);
  if (c.beats >= 4) {
    const p = Math.floor(rng() * 3);
    if (p === 0) return [root, nearest(third, root + 3), nearest(fifth, root + 7), approach()];
    if (p === 1) return [root, nearest(fifth, root + 7), nearest(third, root + 4), approach()];
    const step = nearest(mod(bassPc(c.chord) + 2, 12), root + 2);
    return [root, step, nearest(third, step + 2), approach()];
  }
  if (c.beats === 3) return [root, nearest(fifth, root + 7), approach()];
  if (c.beats === 2) return [root, approach()];
  return [root];
}

/**
 * Événements d'un chorus, triés par temps (depuis le début du chorus).
 * scales : gamme conseillée par accord, pour que le piano sonne comme ce qu'on improvise.
 */
export function arrangeChorus(chart: Chart, chords: FlatChord[], scales: string[], opts: ArrangeOptions, state: ArrangeState, rng: Rng): ArrEvent[] {
  const ev: ArrEvent[] = [];
  const bossa = chart.style === 'bossa';
  const sw = bossa ? 0.5 : SWING;
  const total = chords.reduce((s, c) => s + c.beats, 0);

  chords.forEach((c, i) => {
    const nextC = chords[(i + 1) % chords.length].chord;
    for (let b = 0; b < c.beats; b++) {
      const beat = c.start + b;
      ev.push({ beat, kind: 'pos', bar: c.bar, chord: c.index, beatInBar: beat % chart.beatsPerBar });
    }
    if (opts.bass) {
      if (bossa) {
        const root = nearest(bassPc(c.chord), state.prevBass, 33, 48);
        const fifth = nearest(mod(bassPc(c.chord) + 7, 12), root + 7, 33, BASS_HI);
        const pattern: [number, number, number][] =
          c.beats >= 4 ? [[0, root, 1.4], [1.5, fifth, 0.45], [2, fifth, 1.4], [3.5, root, 0.45]] : [[0, root, 1.4], [1.5, fifth, 0.45]];
        pattern.forEach(([o, midi, dur]) => ev.push({ beat: c.start + o, kind: 'bass', midi, dur, vel: 0.75 }));
        state.prevBass = root;
      } else {
        const line = walkingLine(c, nextC, state.prevBass, i === 0, rng);
        state.prevBass = line[line.length - 1];
        line.forEach((midi, k) => ev.push({ beat: c.start + k, kind: 'bass', midi, dur: 0.92, vel: k === 0 ? 0.85 : 0.72 }));
      }
    }
    if (opts.comp) {
      const notes = voiceLead(c.chord, state.prevVoicing, 50, 74, scales[i]);
      state.prevVoicing = notes;
      let hits: [number, number][];
      if (bossa) {
        hits = c.beats >= 4 ? pick<[number, number][]>([[[0, 1], [1.5, 0.8], [3, 0.8]], [[0, 1.4], [2.5, 1.2]], [[0.5, 1], [2, 1], [3.5, 0.5]]], rng) : [[0, 1], [1.5, 0.4]];
      } else if (c.beats >= 4) {
        hits = pick<[number, number][]>(
          [
            [[0, 0.9], [1 + sw, 1.3]], // Charleston
            [[1, 0.7], [3, 0.7]],
            [[0, 1.8], [2 + sw, 0.9]],
            [[1 + sw, 1.8]],
            [[0, 0.5], [2, 0.9], [3 + sw, 0.4]]
          ],
          rng
        );
      } else if (c.beats >= 2) {
        hits = pick<[number, number][]>([[[0, 0.9]], [[sw, 1.1]], [[0, 0.5], [1 + sw, 0.4]]], rng);
      } else hits = [[0, 0.8]];
      hits.forEach(([o, dur]) => ev.push({ beat: c.start + o, kind: 'chord', notes, dur, vel: 0.42 + rng() * 0.14 }));
    }
  });

  if (opts.drums) {
    for (let b = 0; b < total; b++) {
      const inBar = b % chart.beatsPerBar;
      if (bossa) {
        ev.push({ beat: b, kind: 'hat', vel: 0.16 }, { beat: b + 0.5, kind: 'hat', vel: 0.1 });
      } else {
        ev.push({ beat: b, kind: 'ride', vel: inBar % 2 === 1 ? 0.22 : 0.17 });
        if (inBar % 2 === 1) ev.push({ beat: b, kind: 'hat', vel: 0.28 }, { beat: b + sw, kind: 'ride', vel: 0.1 });
      }
    }
  }
  return ev.sort((x, y) => x.beat - y.beat);
}
