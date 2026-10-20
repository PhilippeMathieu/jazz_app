import { describe, expect, it } from 'vitest';
import { INTERVALS, IV_LEVELS, explainInterval, intervalById, intervalDiff, makeIntervalDuel, makeIntervalQuestion, spellPair } from './intervals';
import { noteName, pcOf } from '../../core/theory/notes';
import { seeded } from '../../core/random';

describe('intervalles', () => {
  it('orthographe : jamais de double altération, et la bonne distance', () => {
    for (const iv of INTERVALS)
      for (let pc = 0; pc < 12; pc++) {
        const [a, b] = spellPair(pc, iv);
        expect(pcOf(a)).toBe(pc);
        expect(pcOf(b)).toBe((pc + iv.semis) % 12);
        expect(Math.abs(b.acc)).toBeLessThan(2);
        expect((a.letter + iv.steps) % 7).toBe(b.letter);
      }
    expect(spellPair(0, intervalById('3m')!).map(noteName)).toEqual(['C', 'E♭']);
    expect(spellPair(1, intervalById('3M')!).map(noteName)).toEqual(['D♭', 'F']);
    expect(spellPair(6, intervalById('3M')!).map(noteName)).toEqual(['G♭', 'B♭']);
    expect(spellPair(4, intervalById('3M')!).map(noteName)).toEqual(['E', 'G♯']);
    expect(spellPair(0, intervalById('tri')!).map(noteName)).toEqual(['C', 'G♭']);
  });

  it('questions : intervalles et sens du niveau, notes dans le médium', () => {
    const rng = seeded(3);
    IV_LEVELS.forEach((lv, level) => {
      for (let i = 0; i < 60; i++) {
        const q = makeIntervalQuestion(level, {}, [], undefined, rng);
        expect(lv.ids).toContain(q.iv.id);
        expect(lv.dirs).toContain(q.dir);
        expect(q.high - q.low).toBe(q.iv.semis);
        expect(q.low).toBeGreaterThanOrEqual(52);
        expect(q.high).toBeLessThanOrEqual(79);
      }
    });
  });

  it('duel : seulement la paire confondue', () => {
    const q = makeIntervalDuel([{ a: '6m', b: '6M', err: 3, ok: 0, score: 3 }], 2, undefined, seeded(1))!;
    expect(['6m', '6M']).toContain(q.iv.id);
    expect([...q.choices!].sort()).toEqual(['6M', '6m']);
    expect(makeIntervalDuel([{ a: 'm7', b: 'maj7', err: 3, ok: 0, score: 3 }], 2)).toBeNull();
  });

  it('correction en mots', () => {
    const q = { ...makeIntervalQuestion(0, {}, [], undefined, seeded(2)), iv: intervalById('7m')!, dir: 'up' as const, a: { letter: 0, acc: 0 }, b: { letter: 6, acc: -1 } };
    const t = explainInterval(q);
    expect(t[0]).toBe('C → B♭, en montant : 10 demi-tons.');
    expect(t[1]).toBe('B♭ est la 7e de C7 et de Cm7.');
    expect(t[2]).toContain('Somewhere');
    expect(intervalDiff('6M', '5')).toBe('6te M = 5te + 2 demi-tons (9 contre 7).');
  });
});
