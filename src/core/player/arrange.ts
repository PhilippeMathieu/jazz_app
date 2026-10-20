// Arrangement d'un chorus (basse walking, comping, batterie), sans audio : testable.
import { Chart, FlatChord } from '../chart/model';
import { Chord, QUALITIES, rootPc } from '../theory/chords';
import { mod, pcOf } from '../theory/notes';
import { voiceLead } from '../audio/voicing';
import { Rng, pick } from '../random';
import type { DrumSound } from '../audio/engine';
import { BassRole, CompHit, GROOVES, grooveOf } from '../rhythm/styles';

export interface ArrangeOptions {
  bass: boolean;
  comp: boolean;
  drums: boolean;
  /** Style joué, à la place de celui de la grille. */
  style?: string;
}
export type ArrEvent =
  /** Début de temps (pour l'affichage). */
  | { beat: number; kind: 'pos'; bar: number; chord: number; beatInBar: number }
  | { beat: number; kind: 'bass'; midi: number; dur: number; vel: number }
  | { beat: number; kind: 'chord'; notes: number[]; dur: number; vel: number }
  | { beat: number; kind: 'drum'; sound: DrumSound; vel: number };

/** Ce qui se prolonge d'un chorus à l'autre (conduite des voix). */
export interface ArrangeState {
  prevBass: number;
  prevVoicing: number[] | null;
}
export const newArrangeState = (): ArrangeState => ({ prevBass: 40, prevVoicing: null });

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

export function walkingLine(c: FlatChord, nextC: Chord, prevNote: number, first: boolean, rng: Rng): number[] {
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
  const bpb = chart.beatsPerBar;
  // Une grille à 3 temps se joue en valse ; une valse ne s'impose pas à une grille à 4 temps.
  const wanted = grooveOf(opts.style ?? chart.style);
  const g = bpb === 3 ? GROOVES.valse : wanted.meter === 3 ? GROOVES.swing : wanted;
  const total = chords.reduce((s, c) => s + c.beats, 0);

  chords.forEach((c, i) => {
    const nextC = chords[(i + 1) % chords.length].chord;
    for (let b = 0; b < c.beats; b++) {
      const beat = c.start + b;
      ev.push({ beat, kind: 'pos', bar: c.bar, chord: c.index, beatInBar: beat % bpb });
    }
    if (opts.bass) {
      if (g.bass === 'walking') {
        const line = walkingLine(c, nextC, state.prevBass, i === 0, rng);
        state.prevBass = line[line.length - 1];
        line.forEach((midi, k) => ev.push({ beat: c.start + k, kind: 'bass', midi, dur: 0.92, vel: k === 0 ? 0.85 : 0.72 }));
      } else {
        const root = nearest(bassPc(c.chord), state.prevBass, 33, 48);
        const note = (role: BassRole) =>
          role === 'root'
            ? root
            : role === 'fifth'
              ? nearest(mod(bassPc(c.chord) + 7, 12), root + 7, 33, BASS_HI)
              : role === 'oct'
                ? (root + 12 <= BASS_HI ? root + 12 : root)
                : nearest(bassPc(nextC), root, 33, 48);
        // Tumbao : pas de note sur le 1, sauf pour lancer le morceau.
        const pattern = g.bass(c.beats);
        if (i === 0 && pattern.every(([o]) => o > 0)) pattern.unshift([0, 'root', 1.4]);
        for (const [o, role, dur] of pattern) if (o < c.beats) ev.push({ beat: c.start + o, kind: 'bass', midi: note(role), dur, vel: o === 0 ? 0.8 : 0.7 });
        state.prevBass = root;
      }
    }
    if (opts.comp) {
      const notes = voiceLead(c.chord, state.prevVoicing, 50, 74, scales[i]);
      state.prevVoicing = notes;
      const options = (c.beats >= 4 ? g.comp[4] : c.beats === 3 ? g.comp[3] : undefined) ?? g.comp[2];
      const hits: CompHit[] = c.beats >= 2 || options !== g.comp[2] ? pick(options, rng) : [[0, 0.8]];
      for (const [o, dur] of hits) if (o < c.beats) ev.push({ beat: c.start + o, kind: 'chord', notes, dur, vel: 0.42 + rng() * 0.14 });
    }
  });

  if (opts.drums) {
    const bars = Math.ceil(total / bpb);
    for (let bar = 0; bar < bars; bar++) {
      for (const [o, sound, vel] of g.drums[bar % g.drums.length]) {
        const beat = bar * bpb + o;
        if (o < bpb && beat < total) ev.push({ beat, kind: 'drum', sound, vel });
      }
    }
  }
  return ev.sort((x, y) => x.beat - y.beat);
}
