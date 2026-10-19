import { describe, expect, it } from 'vitest';
import { nextBatch, statKey, weakness } from './batch';
import { chordSymbol } from '../../core/theory/chords';
import { seeded } from '../../core/random';

const S = { level: 1, type: 'A' as const, order: 'iiVI' as const, delay: 4, sound: true };

describe('flash voicings', () => {
  it('ii–V–I : A, B, A', () => {
    const b = nextBatch(S, 0, {}, () => 0);
    expect(b.map((i) => chordSymbol(i.chord)).join(' ')).toBe('Dm7 G7 Cmaj7');
    expect(b.map((i) => i.type).join('')).toBe('ABA');
  });
  it('ii–V–i mineur : la dominante est 7♭9', () => {
    const b = nextBatch({ ...S, order: 'iiVim' }, 0, {}, () => 0);
    expect(b.map((i) => chordSymbol(i.chord)).join(' ')).toBe('Dø7 G7♭9 Cm6');
  });
  it('cycle de quartes : 12 tonalités, A et B alternés', () => {
    const b = nextBatch({ ...S, order: 'cycle' }, 0);
    expect(b.length).toBe(12);
    expect(new Set(b.map((i) => i.chord.root.letter * 100 + i.chord.root.acc)).size).toBe(12);
  });
  it('les accords ratés ou lents reviennent plus souvent', () => {
    const rng = seeded(3);
    const stats = { 'D♭7 · A': { c: 1, t: 5, ms: 30000 } };
    expect(weakness(stats, 'D♭7 · A')).toBeGreaterThan(weakness({}, 'Cmaj7 · A'));
    let hits = 0;
    for (let n = 0; n < 50; n++) hits += nextBatch({ ...S, order: 'random' }, n, stats, rng).filter((i) => statKey(i) === 'D♭7 · A').length;
    expect(hits).toBeGreaterThan(10);
  });
});
