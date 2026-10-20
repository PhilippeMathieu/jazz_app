import { describe, expect, it } from 'vitest';
import { nextBatch, statKey, weakness } from './batch';
import { QUALITIES, chordPcs, chordSymbol } from '../../core/theory/chords';
import { lhVoicing } from '../../core/audio/voicing';
import { mod } from '../../core/theory/notes';
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
  it('débutant, 3 sons : II – V – I sans 7e, renversement le plus proche', () => {
    const b = nextBatch({ ...S, type: 'triad' }, 0, {}, () => 0);
    expect(b.map((i) => chordSymbol(i.chord)).join(' ')).toBe('Dm G C');
    expect(b.every((i) => i.type === 'triad')).toBe(true);
    let prev: number[] | null = null;
    for (const it of b) {
      const v = lhVoicing(it.chord, 'triad', prev);
      expect(v).toHaveLength(3);
      expect([...new Set(v.map((m) => mod(m, 12)))].sort()).toEqual([...chordPcs(it.chord)].sort());
      if (prev) expect(Math.abs(v[1] - prev[1])).toBeLessThanOrEqual(5);
      prev = v;
    }
    const r = nextBatch({ ...S, type: 'triad', order: 'random' }, 0);
    for (const it of r) expect(['maj', 'min']).toContain(it.chord.quality);
  });
  it('ii–V–I dans les 12 tonalités, par quartes', () => {
    const b = nextBatch({ ...S, type: 'spread', order: 'iiVI12' }, 0, {}, () => 0);
    expect(b).toHaveLength(36);
    expect(b.filter((_, i) => i % 3 === 2).map((i) => chordSymbol(i.chord)).join(' ')).toBe('Cmaj7 Fmaj7 B♭maj7 E♭maj7 A♭maj7 D♭maj7 G♭maj7 Bmaj7 Emaj7 Amaj7 Dmaj7 Gmaj7');
    expect(b[3].context).toContain('2/12');
  });
  it('upper structures : sur les dominantes seulement, avec la triade et l’accord écrit', () => {
    const b = nextBatch({ ...S, type: 'us', order: 'iiVI' }, 0, {}, () => 0);
    expect(b.map((i) => i.type).join(' ')).toBe('spread us spread');
    expect(b[1].us).toBe('II');
    expect(b[1].label).toBe('G13(♯11)');
    const m = nextBatch({ ...S, type: 'us', order: 'iiVim' }, 0, {}, () => 0);
    expect(['bVI', 'bV', 'bIII']).toContain(m[1].us);
    const r = nextBatch({ ...S, type: 'us', order: 'random' }, 0);
    expect(r.every((i) => i.us && QUALITIES[i.chord.quality].family === 'dom')).toBe(true);
  });
});
