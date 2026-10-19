import { describe, expect, it } from 'vitest';
import { lhVoicing } from './voicing';
import { parseChord } from '../theory/chords';

const v = (s: string, t: 'shell' | 'A' | 'B') => lhVoicing(parseChord(s)!, t);

describe('voicings de main gauche', () => {
  it('ii–V–I en C : A, B, A', () => {
    expect(v('Dm7', 'A')).toEqual([53, 57, 60, 64]); // F A C E
    expect(v('G7', 'B')).toEqual([53, 57, 59, 64]); // F A B E
    expect(v('Cmaj7', 'A')).toEqual([52, 55, 59, 62]); // E G B D
  });
  it('type B commence par la 7e', () => {
    expect(v('Cmaj7', 'B')).toEqual([59, 62, 64, 67]); // B D E G
  });
  it('shell : fondamentale, 3ce, 7e', () => {
    expect(v('F7', 'shell')).toEqual([41, 45, 51]); // F A E♭
    expect(v('Aø7', 'shell')).toEqual([45, 48, 55]); // A C G
  });
  it('reste dans le registre de la main gauche', () => {
    for (const s of ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'])
      for (const q of ['maj7', 'm7', '7', 'm7♭5', '7♭9'])
        for (const t of ['A', 'B'] as const) {
          const notes = v(s + q, t);
          expect(Math.min(...notes)).toBeGreaterThanOrEqual(48);
          expect(Math.max(...notes)).toBeLessThanOrEqual(74);
        }
  });
});
