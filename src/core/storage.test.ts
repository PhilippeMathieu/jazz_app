import { describe, expect, it } from 'vitest';
import { merge } from './storage';

describe('stockage', () => {
  const dflt = { mode: 'ear', lv: { ear: 1, prog: 1, build: 1 }, items: {} as Record<string, { c: number; t: number }> };
  it('complète un ancien format', () => {
    const r = merge(dflt, { mode: 'prog', lv: { ear: 3 } });
    expect(r.lv).toEqual({ ear: 3, prog: 1, build: 1 });
    expect(r.mode).toBe('prog');
  });
  it('ignore les valeurs du mauvais type', () => {
    const r = merge(dflt, { mode: 4, lv: 'x', items: [1, 2] });
    expect(r).toEqual(dflt);
  });
  it('garde les entrées des dictionnaires', () => {
    const r = merge(dflt, { items: { 'ear:m7': { c: 2, t: 3 } } });
    expect(r.items['ear:m7']).toEqual({ c: 2, t: 3 });
  });
  it('résiste aux données corrompues', () => {
    expect(merge(dflt, null)).toEqual(dflt);
    expect(merge([1], { a: 1 })).toEqual([1]);
  });
});
