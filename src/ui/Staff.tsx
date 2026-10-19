// Portée d'une note : clé, lignes supplémentaires, altération. Dessinée en SVG (glyphes Bravura).
import { GLYPHS } from './staffGlyphs';
import { BOTTOM_STEP, Clef, Written, stepOf } from '../core/theory/staff';

/** Lignes de la portée en y = 0 (haut) … 4 (bas), en espaces de portée. */
const TOP = -3.6;
const HEIGHT = 11;
const WIDTH = 13;
const NOTE_X = 7.6;

export function Staff({ clef, note, state, label }: { clef: Clef; note: Written; state?: 'ok' | 'bad'; label: string }) {
  const y = 4 - (stepOf(note) - BOTTOM_STEP[clef]) / 2;
  const ledgers: number[] = [];
  for (let l = -1; l >= y; l--) ledgers.push(l);
  for (let l = 5; l <= y; l++) ledgers.push(l);
  const clefGlyph = clef === 'treble' ? GLYPHS.gClef : GLYPHS.fClef;
  const acc = note.acc > 0 ? GLYPHS.accidentalSharp : note.acc < 0 ? GLYPHS.accidentalFlat : null;
  const head = GLYPHS.noteheadWhole;
  return (
    <svg class="staff" viewBox={`0 ${TOP} ${WIDTH} ${HEIGHT}`} role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((l) => (
        <line key={l} class="staff-line" x1={0.3} x2={WIDTH - 0.3} y1={l} y2={l} />
      ))}
      <path class="staff-ink" transform={`translate(0.9 ${clef === 'treble' ? 3 : 1})`} d={clefGlyph.d} />
      {ledgers.map((l) => (
        <line key={l} class="staff-ledger" x1={NOTE_X - 0.45} x2={NOTE_X + head.adv + 0.45} y1={l} y2={l} />
      ))}
      {acc ? <path class={'staff-ink' + (state ? ' ' + state : '')} transform={`translate(${NOTE_X - acc.adv - 0.35} ${y})`} d={acc.d} /> : null}
      <path class={'staff-ink' + (state ? ' ' + state : '')} transform={`translate(${NOTE_X} ${y})`} d={head.d} />
    </svg>
  );
}
