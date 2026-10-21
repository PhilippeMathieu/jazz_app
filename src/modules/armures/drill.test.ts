import { describe, expect, it } from 'vitest';
import { seeded } from '../../core/random';
import { KEYS, accidentals, explain, judgeNames, keysFor, makeQuestion } from './drill';

describe('armures', () => {
  it('altérations dans l’ordre', () => {
    expect(accidentals(3)).toEqual(['F♯', 'C♯', 'G♯']);
    expect(accidentals(-3)).toEqual(['B♭', 'E♭', 'A♭']);
    expect(accidentals(0)).toEqual([]);
  });
  it('règles : dernier ♯ + ½ ton, avant-dernier ♭', () => {
    // dernier dièse + demi-ton = tonique : vérifié sur les lettres
    const up: Record<string, string> = { F: 'G', C: 'D', G: 'A', D: 'E', A: 'B', E: 'F♯', B: 'C♯' };
    for (const k of KEYS.filter((k) => k.n > 0)) expect(up[accidentals(k.n).at(-1)![0]]).toBe(k.major);
    for (const k of KEYS.filter((k) => k.n < -1)) expect(accidentals(k.n).at(-2)).toBe(k.major);
  });
  it('niveaux et questions', () => {
    expect(keysFor(0).map((k) => k.major)).toEqual(['C', 'G', 'D', 'A']);
    const rng = seeded(3);
    for (let lv = 0; lv < 5; lv++)
      for (let i = 0; i < 200; i++) {
        const q = makeQuestion(lv, {}, rng);
        if (q.kind === 'names') {
          expect(lv).toBe(4);
          expect(judgeNames(q, accidentals(q.key.n))).toBe(true);
        } else {
          expect(q.choices).toContain(q.answer);
          expect(new Set(q.choices).size).toBe(q.choices.length);
          expect(q.choices.length).toBeGreaterThanOrEqual(3);
        }
        if (lv < 3) expect(q.minor).toBe(false);
        expect(explain(q).length).toBeGreaterThanOrEqual(2);
      }
  });
  it('explication du relatif mineur', () => {
    const q = { id: 'x', kind: 'sig2key' as const, key: KEYS[3], minor: true, choices: [], answer: 'F♯' };
    expect(explain(q).join(' ')).toContain('A → F♯');
  });
});
