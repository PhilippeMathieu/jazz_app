// Une armure sur la portée, en clé de sol : dièses ou bémols à leur place habituelle.
import { GLYPHS } from './staffGlyphs';

/** Hauteur de chaque altération, en espaces de portée (0 = ligne du haut, fa). */
const SHARP_Y = [0, 1.5, -0.5, 1, 2.5, 0.5, 2];
const FLAT_Y = [2, 0.5, 2.5, 1, 3, 1.5, 3.5];
const X0 = 4.2;
const STEP = 1.15;

export function KeySigStaff({ n, label }: { n: number; label: string }) {
  const glyph = n > 0 ? GLYPHS.accidentalSharp : GLYPHS.accidentalFlat;
  const ys = (n > 0 ? SHARP_Y : FLAT_Y).slice(0, Math.abs(n));
  const width = Math.max(10, X0 + 7 * STEP + 1);
  return (
    <svg class="staff keysig" viewBox={`0 -3.6 ${width} 11`} role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((l) => (
        <line key={l} class="staff-line" x1={0.3} x2={width - 0.3} y1={l} y2={l} />
      ))}
      <path class="staff-ink" transform="translate(0.9 3)" d={GLYPHS.gClef.d} />
      {ys.map((y, i) => (
        <path key={i} class="staff-ink" transform={`translate(${X0 + i * STEP} ${y})`} d={glyph.d} />
      ))}
    </svg>
  );
}
