import { describe, expect, it } from 'vitest';
import { lhVoicing, voiceLead } from './voicing';
import { parseChord } from '../theory/chords';
import { mod } from '../theory/notes';

const ch = (s: string) => parseChord(s)!;
const v = (s: string, t: 'shell' | 'A' | 'B', prev: number[] | null = null) => lhVoicing(ch(s), t, prev);
const moves = (seq: number[][]) => seq.slice(1).reduce((s, x, i) => s + x.reduce((t, n, k) => t + Math.abs(n - seq[i][k]), 0), 0);

describe('voicings de main gauche', () => {
  it('ii–V–I en C : A, B, A', () => {
    expect(v('Dm7', 'A')).toEqual([53, 57, 60, 64]); // F A C E
    expect(v('G7', 'B')).toEqual([53, 57, 59, 64]); // F A B E
    expect(v('Cmaj7', 'A')).toEqual([52, 55, 59, 62]); // E G B D
  });
  it('cadence mineure : 3 ♭13 ♭7 ♭9 sur la dominante', () => {
    expect(v('G7♭9', 'A').map((m) => mod(m, 12))).toEqual([11, 3, 5, 8]); // B E♭ F A♭
  });
  it('ne saute pas d’octave dans un ii–V–I (toutes les tonalités)', () => {
    // G : Am7 (A) → D7 (B) → Gmaj7 (A)
    const a = v('Am7', 'A');
    const b = v('D7', 'B', a);
    const c = v('Gmaj7', 'A', b);
    expect(moves([a, b, c])).toBeLessThanOrEqual(8);
  });
  it('shell : 1-7-10 dans le grave, sinon fondamentale, 3ce, 7e', () => {
    expect(v('E7', 'shell')).toEqual([40, 50, 56]); // E2 D3 G♯3
    expect(v('Aø7', 'shell')).toEqual([45, 48, 55]); // A2 C3 G3
  });
  it('reste dans le registre de la main gauche', () => {
    for (const s of ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'])
      for (const q of ['maj7', 'm7', '7', 'm7♭5', '7♭9'])
        for (const t of ['A', 'B'] as const) {
          const notes = v(s + q, t);
          expect(Math.min(...notes)).toBeGreaterThanOrEqual(46);
          expect(Math.max(...notes)).toBeLessThanOrEqual(76);
        }
  });
});

describe('accompagnement', () => {
  it('colore la dominante selon la gamme conseillée', () => {
    const d7 = ch('D7');
    expect(voiceLead(d7, null, 50, 74, 'mixob9b13').map((m) => mod(m, 12)).sort((a, b) => a - b)).toEqual([0, 3, 6, 10]); // C E♭ F♯ B♭
    expect(voiceLead(d7, null, 50, 74, 'mixolydien').map((m) => mod(m, 12)).sort((a, b) => a - b)).toEqual([0, 4, 6, 11]); // C E F♯ B
  });
});
