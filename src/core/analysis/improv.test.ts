import { describe, expect, it } from 'vitest';
import { guideLine, improvPlan } from './improv';
import { chartById } from '../../library/charts';
import { parseChart } from '../chart/model';
import { chordSymbol, parseChord } from '../theory/chords';
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
    expect(first(r, 'Aø7')).toBe('locrien9');
    expect(first(r, 'D7♭9')).toBe('mixob9b13');
    expect(first(r, 'Gm6')).toBe('melodique');
  });
  it('dominantes secondaires et substitutions', () => {
    expect(first(scalesOf('rhythm-changes'), 'G7')).toBe('mixob9b13');
    expect(first(scalesOf('rhythm-changes'), 'D7')).toBe('mixolydien');
    const p = improvPlan(parseChart('key: C\n| Dm7 | D♭7 | Cmaj7 | Cmaj7 |'));
    expect(p.scales[1].scale).toBe('lydienb7');
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

import { classifyNote, isGuideTone } from './improv';

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
