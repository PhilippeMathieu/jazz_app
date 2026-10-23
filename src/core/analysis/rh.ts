// Au piano : comment enchaîner les accords d'une phrase à la main droite sans sauter (renversements, notes
// communes), et avec quelles couleurs (7e, sus4 → 3ce sur le V). Sans interface, testable.
import { Chord, QUALITIES, rootPc } from '../theory/chords';
import { mod, noteName, pcOf, spellWith } from '../theory/notes';

export type Color = 'simple' | 'couleurs';

/** Notes (demi-tons au-dessus de la fondamentale) jouées à la main droite. */
export function rhIntervals(c: Chord, degree: string, color: Color): number[] {
  const q = QUALITIES[c.quality];
  const fam = q.family;
  const third = q.sus ? 5 : fam === 'maj' || fam === 'dom' || fam === 'aug' ? 4 : 3;
  const fifth = fam === 'dim' || fam === 'hdim' ? 6 : fam === 'aug' ? 8 : 7;
  if (color === 'simple') return [0, third, fifth];
  // Couleurs : la 7e de l'accord (écrite, sinon celle de son degré dans la gamme).
  const written = q.iv.find((x) => x === 9 || x === 10 || x === 11);
  let seventh = written;
  if (seventh === undefined) {
    if (fam === 'dom' || degree === 'V' || degree === 'bVII' || degree === '♭VII') seventh = 10;
    else if (fam === 'maj' || fam === 'aug') seventh = 11;
    else if (fam === 'dim') seventh = 9;
    else seventh = 10;
  }
  return [0, third, fifth, seventh];
}

const MOVE = (a: number[], b: number[]) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);

/** Position serrée d'un accord : ses notes rangées au-dessus de la plus grave. */
function close(pcs: number[], low: number): number[] {
  const out = [low];
  for (const pc of pcs.slice(1)) {
    let m = out[out.length - 1] + 1;
    while (mod(m, 12) !== pc) m++;
    out.push(m);
  }
  return out;
}

/**
 * Voicings de main droite enchaînés : le premier en position fondamentale autour du do central, puis à chaque
 * accord le renversement (position serrée) qui bouge le moins, note grave entre G3 et G4.
 */
export function chain(chords: Chord[], degrees: string[], color: Color): number[][] {
  const out: number[][] = [];
  chords.forEach((c, i) => {
    const r = rootPc(c);
    const pcs = rhIntervals(c, degrees[i] ?? '', color).map((x) => mod(r + x, 12));
    const options: number[][] = [];
    for (let rot = 0; rot < pcs.length; rot++) {
      const order = [...pcs.slice(rot), ...pcs.slice(0, rot)];
      for (let low = 55; low <= 67; low++) if (mod(low, 12) === order[0]) options.push(close(order, low));
    }
    const prev = out[out.length - 1];
    if (!prev) {
      // Fondamentale à partir de C4 (ou juste en dessous).
      const low = 60 + mod(pcs[0] - 60, 12) - (mod(pcs[0] - 60, 12) > 7 ? 12 : 0);
      out.push(close(pcs, low));
      return;
    }
    const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
    const p = sorted(prev);
    let best = options[0];
    for (const v of options) {
      const cost = p.length === v.length ? MOVE(p, sorted(v)) : Math.abs(p[0] - v[0]) * 3;
      const bestCost = p.length === best.length ? MOVE(p, sorted(best)) : Math.abs(p[0] - best[0]) * 3;
      if (cost < bestCost) best = v;
    }
    out.push(sorted(best));
  });
  return out;
}

/** Nom d'une note dans un accord, orthographiée par rapport à sa fondamentale (G♯ dans E7, A♭ dans F m). */
export function spellIn(c: Chord, midi: number): string {
  const semis = mod(midi - pcOf(c.root), 12);
  const dim7 = c.quality === 'dim7' && semis === 9;
  const off = dim7 ? 6 : [0, 1, 1, 2, 2, 3, 4, 4, 4, 5, 6, 6][semis];
  return noteName(spellWith(c.root.letter + off, midi));
}

/** Ce qui se passe entre deux voicings : les notes qui restent, celles qui bougent (et de combien). */
export function moves(a: number[], b: number[], ca: Chord, cb: Chord): { stay: string[]; go: string[] } {
  const stay = a.filter((m) => b.includes(m)).map((m) => spellIn(cb, m));
  const go: string[] = [];
  const from = a.filter((m) => !b.includes(m));
  const to = b.filter((m) => !a.includes(m));
  from.forEach((m, i) => {
    const t = to[i];
    if (t === undefined) return;
    const d = t - m;
    const step = Math.abs(d) === 1 ? '½ ton' : Math.abs(d) === 2 ? '1 ton' : `${Math.abs(d)} demi-tons`;
    go.push(`${spellIn(ca, m)} ${d > 0 ? '↑' : '↓'} ${step} → ${spellIn(cb, t)}`);
  });
  return { stay, go };
}
