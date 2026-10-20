import { describe, expect, it } from 'vitest';
import { parseChord } from '../../core/theory/chords';
import { chartById } from '../../library/charts';
import { LESSONS } from './lessons';
import { rhythmById } from '../../core/rhythm/patterns';
import { GROOVES } from '../../core/rhythm/styles';

const ROUTES = ['oreille', 'tonalite', 'express', 'flash', 'lecture', 'grilles', 'rythme'];

describe('cours', () => {
  it('identifiants uniques', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });
  for (const l of LESSONS)
    it(`leçon « ${l.title} » : accords, quiz et liens valides`, () => {
      expect(l.blocks.some((b) => b.t === 'go')).toBe(true);
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
        if (b.t === 'grooves') for (const id of b.styles) expect(GROOVES[id], id).toBeTruthy();
        if (b.t === 'table') for (const r of b.rows) expect(r).toHaveLength(b.head.length);
        if (b.t === 'go')
          for (const g of b.links) {
            const [page, id] = g.href.replace('#/', '').split('/');
            if (page === 'grille') expect(chartById(id), g.href).toBeTruthy();
            else expect(ROUTES, g.href).toContain(page);
          }
      }
    });
});
