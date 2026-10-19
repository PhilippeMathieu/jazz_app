import { describe, expect, it } from 'vitest';
import { seeded } from '../../core/random';
import { midiOf, stepOf, writtenName } from '../../core/theory/staff';
import { BOTTOM_STEP } from '../../core/theory/staff';
import { itemsFor, keyIsRight, makeQuestion, nameIsRight, playedVerdict, solfegeName } from './reading';

const names = (level: number, clef: 'treble' | 'bass') =>
  itemsFor(level)
    .filter((x) => x.clef === clef)
    .map((x) => writtenName(x.note));

describe('lecture de notes', () => {
  it('étendues par niveau', () => {
    const n1 = names(1, 'treble');
    expect(n1[0]).toBe('D4');
    expect(n1[n1.length - 1]).toBe('G5');
    expect(names(1, 'bass')).toHaveLength(0);
    const n2 = names(2, 'bass');
    expect([n2[0], n2[n2.length - 1]]).toEqual(['F2', 'B3']);
    const t3 = names(3, 'treble');
    const b3 = names(3, 'bass');
    expect([t3[0], t3[t3.length - 1], b3[0], b3[b3.length - 1]]).toEqual(['A3', 'C6', 'C2', 'E4']);
  });
  it('N4 : dièses et bémols usuels seulement', () => {
    const all = itemsFor(4).map((x) => writtenName(x.note));
    expect(all).toContain('F♯4');
    expect(all).toContain('B♭2');
    expect(all.some((n) => /^(E♯|B♯|C♭|F♭)/.test(n))).toBe(false);
  });
  it('hauteurs et positions', () => {
    const c4 = { letter: 0, acc: 0, octave: 4 };
    expect(midiOf(c4)).toBe(60);
    // do central : une ligne sous la portée de sol, une au-dessus de la portée de fa
    expect(stepOf(c4) - BOTTOM_STEP.treble).toBe(-2);
    expect(stepOf(c4) - BOTTOM_STEP.bass).toBe(10);
    expect(solfegeName({ letter: 3, acc: 1, octave: 4 })).toBe('fa dièse');
  });
  it('vérifie les réponses (nom, touche, piano)', () => {
    const q = { id: 'x', clef: 'treble' as const, note: { letter: 4, acc: -1, octave: 4 }, midi: 66 };
    expect(nameIsRight(q, 4, -1)).toBe(true);
    expect(nameIsRight(q, 3, 1)).toBe(false); // F♯ ≠ G♭ à la lecture
    expect(keyIsRight(q, 78)).toBe(true); // la bonne touche, une autre octave
    expect(playedVerdict(q, 66)).toBe('ok');
    expect(playedVerdict(q, 54)).toBe('octave');
    expect(playedVerdict(q, 67)).toBe('wrong');
  });
  it('tirage : jamais deux fois la même, les erreurs reviennent', () => {
    const rng = seeded(5);
    let prev: string | undefined;
    for (let i = 0; i < 300; i++) {
      const q = makeQuestion(4, {}, rng, prev);
      expect(q.id).not.toBe(prev);
      prev = q.id;
    }
    const tally = { 'G:A4': { c: 0, t: 5 } };
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (makeQuestion(1, tally, rng).id === 'G:A4') hits++;
    expect(hits / 2000).toBeGreaterThan(0.15); // 11 notes : ≈ 9 % sans pondération
  });
});
