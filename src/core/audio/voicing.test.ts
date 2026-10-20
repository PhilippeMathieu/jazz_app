import { describe, expect, it } from 'vitest';
import { US_IDS, UsId, lhVoicing, twoHands, voiceLead } from './voicing';
import { QUALITIES, parseChord } from '../theory/chords';
import { mod, pcOf } from '../theory/notes';

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

describe('voicings à deux mains', () => {
  const QS = ['maj7', 'm7', '7', 'm7b5', 'dim7', '6', 'm6', '7b9', '7#9', '13', '7sus4', 'maj9', 'm9', '9'];
  const ROOTS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  it('mains jouables, notes de l’accord ou tensions, registre du piano', () => {
    for (const type of ['spread', 'quartal', 'drop2'] as const)
      for (const r of ROOTS)
        for (const q of QS) {
          const c = ch(r + (q === '7b9' ? '7♭9' : q === '7#9' ? '7♯9' : q === 'm7b5' ? 'm7b5' : q === 'dim7' ? '°7' : q));
          const { notes, lh } = twoHands(c, type);
          const L = notes.slice(0, lh);
          const R = notes.slice(lh);
          expect([...notes].sort((a, b) => a - b)).toEqual(notes);
          expect(new Set(notes).size).toBe(notes.length);
          expect(L[L.length - 1] - L[0]).toBeLessThanOrEqual(12); // une main : une octave au plus
          expect(R[R.length - 1] - R[0]).toBeLessThanOrEqual(12);
          expect(notes[0]).toBeGreaterThanOrEqual(36);
          expect(notes[notes.length - 1]).toBeLessThanOrEqual(81);
          // La 3ce (ou la 4te des sus) et la 7e (ou 6te) sont là.
          const rel = notes.map((m) => mod(m - mod(pcOf(c.root), 12), 12));
          expect(rel.some((x) => x === 3 || x === 4 || (QUALITIES[c.quality].sus && x === 5)), `${type} ${r}${q}`).toBe(true);
          expect(rel.some((x) => x === 9 || x === 10 || x === 11), `${type} ${r}${q}`).toBe(true);
        }
  });
  it('So What sur Dm7 : D G C | F A', () => {
    expect(twoHands(ch('Dm7'), 'quartal')).toEqual({ notes: [50, 55, 60, 65, 69], lh: 3 });
  });
  it('drop 2 de Cmaj7 : la 2e voix depuis le haut passe à la main gauche', () => {
    const { notes, lh } = twoHands(ch('Cmaj7'), 'drop2');
    expect(lh).toBe(1);
    expect(notes.map((m) => mod(m, 12)).sort((a, b) => a - b)).toEqual([0, 4, 7, 11]);
    expect(notes[1] - notes[0]).toBeGreaterThan(4); // la note descendue laisse un trou
  });
  it('upper structures : 3 et 7 à la main gauche, la bonne triade à la main droite', () => {
    const want: Record<UsId, number[]> = { II: [2, 6, 9], VI: [9, 1, 4], bVI: [8, 0, 3], bIII: [3, 7, 10], bV: [6, 10, 1] };
    for (const us of US_IDS) {
      const { notes, lh } = twoHands(ch('C7'), 'us', null, us);
      expect(lh).toBe(2);
      expect(notes.slice(0, 2).map((m) => mod(m, 12)).sort((a, b) => a - b)).toEqual([4, 10]);
      expect(notes.slice(2).map((m) => mod(m, 12)).sort((a, b) => a - b)).toEqual([...want[us]].sort((a, b) => a - b));
      expect(notes[2]).toBeGreaterThan(notes[1]);
    }
  });
  it('enchaînés, les voicings bougent peu', () => {
    for (const type of ['spread', 'quartal', 'drop2'] as const) {
      const a = twoHands(ch('Dm7'), type).notes;
      const b = twoHands(ch('G7'), type, a).notes;
      const c = twoHands(ch('Cmaj7'), type, b).notes;
      expect(Math.abs(b[0] - a[0]), type).toBeLessThanOrEqual(7);
      expect(Math.abs(c[c.length - 1] - b[b.length - 1]), type).toBeLessThanOrEqual(7);
    }
  });
});
