// Mise en page d'une grille : lignes de 4 mesures, accords par mesure.
import { Chart, FlatChord } from './model';

export interface BarRow {
  label?: string;
  bars: number[];
}

/** Lignes de 4 mesures, avec retour à la ligne à chaque section. */
export function barRows(chart: Chart): BarRow[] {
  const out: BarRow[] = [];
  chart.bars.forEach((b, i) => {
    const last = out[out.length - 1];
    if (!last || b.section || last.bars.length === 4) out.push({ label: b.section, bars: [i] });
    else last.bars.push(i);
  });
  return out;
}

/** Indices des accords (à plat) de chaque mesure. */
export function chordsByBar(flat: FlatChord[]): Map<number, number[]> {
  const m = new Map<number, number[]>();
  flat.forEach((f) => m.set(f.bar, [...(m.get(f.bar) ?? []), f.index]));
  return m;
}
