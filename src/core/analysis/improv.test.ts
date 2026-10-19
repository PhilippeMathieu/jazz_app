import { describe, expect, it } from 'vitest';
import { classifyNote, guideLine, improvPlan, isGuideTone } from './improv';
import { chartById } from '../../library/charts';
import { parseChart } from '../chart/model';
import { chordSymbol, parseChord, rootPc } from '../theory/chords';
import { scaleNames } from '../theory/scales';
import { parseNote } from '../theory/notes';

function scalesOf(id: string) {
  const p = improvPlan(chartById(id)!);
  return p.flat.map((f, i) => ({ sym: chordSymbol(f.chord), scale: p.scales[i].scale }));
}
const first = (rows: { sym: string; scale: string }[], sym: string) => rows.find((r) => r.sym === sym)?.scale;

describe('gammes', () => {
  it('Autumn Leaves', () => {
    const r = scalesOf('autumn-leaves');
    expect(first(r, 'Cm7')).toBe('dorien');
    expect(first(r, 'F7')).toBe('mixolydien');
    expect(first(r, 'B♭maj7')).toBe('ionien');
    expect(first(r, 'E♭maj7')).toBe('lydien');
    expect(first(r, 'Aø7')).toBe('locrien');
    expect(first(r, 'D7♭9')).toBe('mixob9b13');
    expect(first(r, 'Gm6')).toBe('melodique');
  });
  it('dominantes secondaires et substitutions', () => {
    expect(first(scalesOf('rhythm-changes'), 'G7')).toBe('mixob9b13');
    expect(first(scalesOf('rhythm-changes'), 'D7')).toBe('mixolydien');
    const p = improvPlan(parseChart('key: C\n| Dm7 | D♭7 | Cmaj7 | Cmaj7 |'));
    expect(p.scales[1].scale).toBe('lydienb7');
  });
  it('une dominante sur plusieurs mesures garde la même gamme', () => {
    const p = improvPlan(parseChart('key: Cm\n| Dø7 | G7 | G7 | Cm7 |'));
    expect(p.scales[1].scale).toBe('mixob9b13');
    expect(p.scales[2].scale).toBe('mixob9b13');
    const s = improvPlan(parseChart('key: C\n| Dm7 | D♭7 | D♭7 | Cmaj7 |'));
    expect([s.scales[1].scale, s.scales[2].scale]).toEqual(['lydienb7', 'lydienb7']);
  });
  it('respecte les tensions écrites, même sans résolution', () => {
    const p = improvPlan(parseChart('key: G\n| Eø7 | A7♭9 | Cm7 | Cm7 |'));
    expect(p.scales[1].scale).toBe('mixob9b13');
  });
  it('blues : I7 en mixolydien (couleur blues)', () => {
    const p = improvPlan(chartById('blues-f')!);
    expect(p.scales[0].scale).toBe('mixolydien');
    expect(p.scales[0].alt).toBe('blues');
  });
  it('orthographie les gammes', () => {
    const d = parseNote('D')!.note;
    expect(scaleNames(d, 2, 'mixob9b13').join(' ')).toBe('D E♭ F♯ G A B♭ C');
    const g = parseNote('G')!.note;
    expect(scaleNames(g, 7, 'alteree').join(' ')).toBe('G A♭ A♯ B C♯ E♭ F');
  });
  it('lignes de guide tones', () => {
    const ch = ['Cm7', 'F7', 'B♭maj7'].map((s) => parseChord(s)!);
    expect(guideLine(ch, 'third').map((g) => g.name).join(' ')).toBe('E♭ E♭ D');
    expect(guideLine(ch, 'seventh').map((g) => g.name).join(' ')).toBe('B♭ A A');
  });
  it('guide tones : deux voix distinctes, conduites par demi-ton dans les quartes', () => {
    for (const id of ['autumn-leaves', 'all-the-things', 'rhythm-changes', 'cycle-maj']) {
      const plan = improvPlan(chartById(id)!);
      let fourths = 0;
      let smooth = 0;
      plan.flat.forEach((f, i) => {
        expect(plan.guideA[i].midi % 12).not.toBe(plan.guideB[i].midi % 12);
        expect(plan.guideB[i].midi).toBeLessThan(plan.guideA[i].midi);
        const nx = plan.flat[i + 1];
        if (!nx || (rootPc(nx.chord) - rootPc(f.chord) + 12) % 12 !== 5) return;
        fourths++;
        const moves = [plan.guideA, plan.guideB].map((l) => Math.abs(l[i + 1].midi - l[i].midi));
        if (Math.max(...moves) <= 2) smooth++;
      });
      // Une remontée d'octave de temps en temps, sinon demi-ton ou note commune.
      expect(smooth / fourths).toBeGreaterThanOrEqual(0.9);
    }
  });
});

describe('lecture tolérante', () => {
  it('accepte les notations des applis de grilles', () => {
    expect(parseChord('C7M', true)?.quality).toBe('maj7');
    expect(parseChord('G7(b9)', true)?.quality).toBe('7b9');
    expect(parseChord('Bm7(b5)', true)?.quality).toBe('m7b5');
    expect(parseChord('Dm7(9)', true)?.quality).toBe('m9');
    expect(parseChord('A7(9,13)', true)?.quality).toBe('13');
    expect(parseChord('Go', true)).toBeNull();
    expect(parseChord('Be', true)).toBeNull();
  });
});


describe('notes jouées en impro', () => {
  it('classe une note par rapport à l’accord et à la gamme', () => {
    const d7 = parseChord('D7')!;
    expect(classifyNote(6, d7, 'mixob9b13')).toBe('chord'); // F♯ = 3
    expect(classifyNote(3, d7, 'mixob9b13')).toBe('scale'); // E♭ = ♭9
    expect(classifyNote(4, d7, 'mixob9b13')).toBe('out'); // E = 9 naturelle, hors ♭9 ♭13
    expect(isGuideTone(0, d7)).toBe(true); // C = 7
    expect(isGuideTone(9, d7)).toBe(false); // A = 5
  });
});
