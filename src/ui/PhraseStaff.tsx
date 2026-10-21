// Portée d'une phrase : clé de sol, têtes, hampes, croches liées par deux, altérations, barres de mesure, accords au-dessus.
// Dessinée en SVG ; unité = un interligne.
import { GLYPHS } from './staffGlyphs';
import { BOTTOM_STEP, Written, stepOf } from '../core/theory/staff';

export interface StaffNote {
  w: Written;
  /** Début et durée en croches. */
  start: number;
  dur: number;
}

const X0 = 4.2;
const BAR = 8;
const PAD = 1.1;
/** Place prise par une note selon sa durée (espacement non proportionnel, plus compact). */
const space = (dur: number) => (dur >= 8 ? 4 : dur >= 4 ? 3.2 : dur >= 2 ? 2.5 : 1.75);
const yOf = (w: Written) => 4 - (stepOf(w) - BOTTOM_STEP.treble) / 2;
const HEAD_W = 1.18;
const STEM = 3.3;

export function PhraseStaff({
  notes,
  chords,
  states = [],
  current = -1,
  label
}: {
  notes: StaffNote[];
  chords: string[];
  /** Par note : juste, manquée, ou rien. */
  states?: ('ok' | 'bad' | undefined)[];
  /** Note en cours de lecture (surlignée). */
  current?: number;
  label: string;
}) {
  // Abscisses : chaque note prend sa place, plus celle de son altération.
  const bars = Math.max(chords.length, Math.ceil(notes.reduce((s, n) => Math.max(s, n.start + n.dur), 0) / BAR));
  const xs: number[] = [];
  const accs: (number | null)[] = [];
  const barX: number[] = [];
  let x = X0;
  let state = new Map<string, number>();
  let bar = -1;
  notes.forEach((n) => {
    const b = Math.floor(n.start / BAR);
    while (bar < b) {
      bar++;
      if (bar > 0) {
        barX.push(x - 0.4);
        x += PAD;
      } else barX.push(X0 - 0.8);
      state = new Map();
    }
    const k = `${n.w.letter}${n.w.octave}`;
    const shown = (state.get(k) ?? 0) !== n.w.acc ? n.w.acc : null;
    state.set(k, n.w.acc);
    if (shown !== null) x += 1.1;
    xs.push(x);
    accs.push(shown);
    x += space(n.dur);
  });
  while (barX.length < bars) {
    barX.push(x - 0.4);
    x += PAD + 3;
  }
  const width = x + 0.4;
  const ys = notes.map((n) => yOf(n.w));

  // Hampes : croches par deux (même temps), sinon seules ; vers le bas au-dessus de la ligne du milieu.
  const stems: { i: number; up: boolean; end: number }[] = [];
  const beams: [number, number, boolean, number][] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.dur >= 8) continue;
    const m = notes[i + 1];
    if (n.dur === 1 && n.start % 2 === 0 && m && m.dur === 1 && m.start === n.start + 1) {
      const up = (ys[i] + ys[i + 1]) / 2 >= 2;
      const end = up ? Math.min(ys[i], ys[i + 1]) - STEM : Math.max(ys[i], ys[i + 1]) + STEM;
      stems.push({ i, up, end }, { i: i + 1, up, end });
      beams.push([i, i + 1, up, end]);
      i++;
    } else stems.push({ i, up: ys[i] >= 2, end: ys[i] >= 2 ? ys[i] - STEM : ys[i] + STEM });
  }
  // Cadre : la portée, les têtes, les hampes, et une ligne pour les accords au-dessus.
  const ends = stems.map((x) => x.end);
  const top = Math.min(-1.2, ...ys.map((y) => y - 0.8), ...ends) - 2.6;
  const bottom = Math.max(5.2, ...ys.map((y) => y + 0.8), ...ends) + 0.8;
  const stemX = (i: number, up: boolean) => (up ? xs[i] + HEAD_W - 0.06 : xs[i] + 0.06);
  const cls = (i: number) => 'staff-ink' + (i === current ? ' cur' : states[i] ? ' ' + states[i] : '');
  const accGlyph = (a: number) => (a > 0 ? GLYPHS.accidentalSharp : a < 0 ? GLYPHS.accidentalFlat : GLYPHS.accidentalNatural);

  return (
    <svg class="staff phrase-staff" viewBox={`0 ${top} ${width} ${bottom - top}`} role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((l) => (
        <line key={l} class="staff-line" x1={0.3} x2={width - 0.3} y1={l} y2={l} />
      ))}
      <path class="staff-ink" transform="translate(0.9 3)" d={GLYPHS.gClef.d} />
      {barX.slice(1).map((bx, i) => (
        <line key={'b' + i} class="staff-bar" x1={bx} x2={bx} y1={0} y2={4} />
      ))}
      <line class="staff-bar" x1={width - 0.3} x2={width - 0.3} y1={0} y2={4} />
      {chords.map((c, i) => (
        <text key={'c' + i} class="staff-chord" x={(barX[i] ?? 0) + (i === 0 ? 0.8 : 0.6)} y={top + 1.7}>
          {c}
        </text>
      ))}
      {notes.map((n, i) => {
        const y = ys[i];
        const ledgers: number[] = [];
        for (let l = -1; l >= y; l--) ledgers.push(l);
        for (let l = 5; l <= y; l++) ledgers.push(l);
        const acc = accs[i];
        const g = acc !== null ? accGlyph(acc) : null;
        return (
          <g key={i}>
            {ledgers.map((l) => (
              <line key={l} class="staff-ledger" x1={xs[i] - 0.4} x2={xs[i] + HEAD_W + 0.4} y1={l} y2={l} />
            ))}
            {g ? <path class={cls(i)} transform={`translate(${xs[i] - g.adv - 0.3} ${y})`} d={g.d} /> : null}
            {n.dur >= 8 ? (
              <path class={cls(i)} transform={`translate(${xs[i]} ${y})`} d={GLYPHS.noteheadWhole.d} />
            ) : (
              <ellipse class={cls(i)} cx={xs[i] + HEAD_W / 2} cy={y} rx={HEAD_W / 2} ry={0.42} transform={`rotate(-20 ${xs[i] + HEAD_W / 2} ${y})`} />
            )}
          </g>
        );
      })}
      {stems.map(({ i, up, end }) => (
        <line key={'s' + i} class={'staff-stem ' + cls(i)} x1={stemX(i, up)} x2={stemX(i, up)} y1={ys[i]} y2={end} />
      ))}
      {beams.map(([a, b, up, end]) => (
        <path
          key={'beam' + a}
          class="staff-ink"
          d={`M${stemX(a, up)} ${end} L${stemX(b, up) + (up ? 0.07 : 0)} ${end} L${stemX(b, up) + (up ? 0.07 : 0)} ${end + (up ? 0.5 : -0.5)} L${stemX(a, up)} ${end + (up ? 0.5 : -0.5)} Z`}
        />
      ))}
    </svg>
  );
}
