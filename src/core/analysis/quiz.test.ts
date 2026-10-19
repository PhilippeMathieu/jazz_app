import { describe, expect, it } from 'vitest';
import { romanChoices } from './quiz';
import { analyze } from './analyze';
import { chartById, LIBRARY } from '../../library/charts';
import { flatten } from '../chart/model';
import { seeded } from '../random';

describe('quiz d’analyse', () => {
  it('quatre choix distincts dont la bonne réponse, sur toutes les grilles', () => {
    const rng = seeded(1);
    for (const c of LIBRARY) {
      const a = analyze(c);
      flatten(c).forEach((f, i) => {
        const ch = romanChoices(f.chord, a.chords[i].roman, c.key, rng);
        expect(ch).toContain(a.chords[i].roman);
        expect(new Set(ch).size).toBe(ch.length);
        expect(ch.length).toBe(4);
      });
    }
    expect(chartById('autumn-leaves')).toBeTruthy();
  });
});
