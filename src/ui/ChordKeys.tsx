// Un accord montré au clavier après une réponse : notes nommées, degrés dessous,
// et au besoin une note mise en avant (la 9e demandée) ou toute la gamme.
import { Chord, QUALITIES, degreeLabel, rootPc, spellInChord } from '../core/theory/chords';
import { mod } from '../core/theory/notes';
import { Keyboard, Mark } from './Keyboard';
import { scaleMarks } from './keyboardMarks';
import { ListenButtons, useListen, withActive } from './Listen';

export function ChordKeys({ chord, extra, scale }: { chord: Chord; extra?: number; scale?: string }) {
  const l = useListen();
  const r = rootPc(chord);
  const base = 48 + r; // fondamentale entre C3 et B3, état fondamental
  const notes = QUALITIES[chord.quality].iv.map((i) => base + i);
  const extraMidi = extra === undefined ? undefined : base + 12 + mod(extra - r, 12);
  const top = Math.max(...notes, extraMidi ?? 0);
  const lo = 48;
  const hi = Math.max(71, 12 * Math.ceil((top + 1) / 12) - 1);
  let marks: Record<number, Mark> = {};
  let labels: Record<number, string> = {};
  if (scale) ({ marks, labels } = scaleMarks(chord, scale, lo, hi));
  else
    for (const m of notes) {
      marks[m] = 'hit';
      labels[m] = spellInChord(chord, m);
    }
  if (extraMidi !== undefined) {
    marks[extraMidi] = 'ok';
    labels[extraMidi] = spellInChord(chord, extraMidi);
  }
  const shown = scale ? [] : [...notes, ...(extraMidi !== undefined ? [extraMidi] : [])];
  return (
    <div class="chord-keys">
      <Keyboard lo={lo} hi={hi} fit marks={withActive(marks, l.active)} labels={labels} />
      <ListenButtons small notes={[...notes, ...(extraMidi !== undefined ? [extraMidi] : [])]} l={l} />
      {shown.length ? (
        <p class="chord-keys-line">
          {shown.map((m) => (
            <span key={m} class={m === extraMidi ? 'ok' : ''}>
              <b>{spellInChord(chord, m)}</b>
              <small>{degreeLabel(chord, m)}</small>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
