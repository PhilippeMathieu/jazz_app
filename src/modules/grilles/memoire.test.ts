import { describe, expect, it } from 'vitest';
import { maskFor, memChoices } from './Memoire';
import { parseChord, chordSymbol } from '../../core/theory/chords';
import { seeded } from '../../core/random';

describe('mémoire des grilles', () => {
  it('proportion cachée selon le niveau ; au niveau 3/4, le début de chaque ligne reste visible', () => {
    expect(maskFor(32, 0, [], seeded(1)).size).toBe(8);
    expect(maskFor(32, 1, [], seeded(1)).size).toBe(16);
    const m = maskFor(32, 2, [0, 8, 16, 24], seeded(1));
    expect(m.size).toBe(28);
    for (const f of [0, 8, 16, 24]) expect(m.has(f)).toBe(false);
    expect(maskFor(32, 3, [0], seeded(1)).size).toBe(32);
  });
  it('4 choix distincts dont le bon', () => {
    const chords = ['Cm7', 'F7', 'B♭maj7', 'E♭maj7', 'Aø7', 'D7♭9', 'Gm6', 'Gm6'].map((x) => parseChord(x)!);
    for (let i = 0; i < chords.length; i++) {
      const c = memChoices(chords, i, seeded(i + 3));
      expect(c).toContain(chordSymbol(chords[i]));
      expect(new Set(c).size).toBe(c.length);
      expect(c.length).toBe(4);
    }
  });
});
