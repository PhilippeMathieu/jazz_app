// Repères à poser sur le clavier : gamme, voicing, guide tones.
import { Chord, QUALITIES, chordPcs, spellInChord } from '../core/theory/chords';
import { mod, noteName, pcOf } from '../core/theory/notes';
import { scaleNotes } from '../core/theory/scales';
import type { Mark } from './Keyboard';

export interface Marks {
  marks: Record<number, Mark>;
  labels: Record<number, string>;
}

/** Gamme sur toute la tessiture : notes de l'accord en plein, autres notes en clair. */
export function scaleMarks(c: Chord, scale: string, lo: number, hi: number): Marks {
  const notes = scaleNotes(c.root, pcOf(c.root), scale);
  const names = new Map(notes.map((n) => [pcOf(n), noteName(n)]));
  const tones = new Set(chordPcs(c).filter((_, i) => QUALITIES[c.quality].iv[i] < 12));
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  for (let m = lo; m <= hi; m++) {
    const p = mod(m, 12);
    if (!names.has(p)) continue;
    marks[m] = tones.has(p) ? 'hit' : 'soft';
    labels[m] = names.get(p)!;
  }
  return { marks, labels };
}

/** Notes jouées (voicing), nommées dans l'accord. */
export function notesMarks(c: Chord, notes: number[], mark: Mark = 'hit'): Marks {
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  for (const m of notes) {
    marks[m] = mark;
    labels[m] = spellInChord(c, m);
  }
  return { marks, labels };
}
