import { describe, expect, it } from 'vitest';
import { parseChord } from '../../core/theory/chords';
import { LESSONS } from './lessons';
import { STEPS } from '../../parcours/steps';
import { rhythmById } from '../../core/rhythm/patterns';


describe('cours', () => {
  it('identifiants uniques', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });
  for (const l of LESSONS)
    it(`leçon « ${l.title} » : accords, quiz et tableaux valides`, () => {
      for (const b of l.blocks) {
        if (b.t === 'chords') {
          for (const c of b.chords) expect(parseChord(c), c).not.toBeNull();
          if (b.romans) expect(b.romans).toHaveLength(b.chords.length);
        }
        if (b.t === 'quiz') {
          expect(b.answer).toBeGreaterThanOrEqual(0);
          expect(b.answer).toBeLessThan(b.choices.length);
          expect(new Set(b.choices).size).toBe(b.choices.length);
        }
        if (b.t === 'rhythm') expect(rhythmById(b.id), b.id).toBeTruthy();
        if (b.t === 'table') for (const r of b.rows) expect(r).toHaveLength(b.head.length);
      }
    });
  it('chaque leçon sert dans le parcours, et chaque leçon du parcours existe', () => {
    const used = STEPS.flatMap((st) => st.lessons);
    for (const id of used) expect(LESSONS.find((l) => l.id === id), id).toBeTruthy();
    for (const l of LESSONS) expect(used, l.id).toContain(l.id);
  });
});
