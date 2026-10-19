// Notes écrites sur une portée : lettre, altération et octave (C4 = do central = MIDI 60).
import { NATURAL_PC, Note, noteName } from './notes';

export type Clef = 'treble' | 'bass';
export interface Written extends Note {
  octave: number;
}

export const midiOf = (w: Written) => 12 * (w.octave + 1) + NATURAL_PC[w.letter] + w.acc;
/** Rang diatonique (C4 = 28) : sert à placer la note sur la portée. */
export const stepOf = (w: Written) => 7 * w.octave + w.letter;
export const writtenName = (w: Written) => noteName(w) + w.octave;
/** Ligne du bas de chaque portée : E4 (sol), G2 (fa). */
export const BOTTOM_STEP: Record<Clef, number> = { treble: 7 * 4 + 2, bass: 7 * 2 + 4 };
