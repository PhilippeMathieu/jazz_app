import { PROGRESSIONS } from '../../core/theory/progressions';
import { describe, expect, it } from 'vitest';
import { checkBuild, earVoicing, makeEarQuestion } from './questions';
import { chordPcs, parseChord } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { seeded } from '../../core/random';

describe('oreille', () => {
  it('le voicing contient les bonnes notes à chaque niveau', () => {
    const rng = seeded(2);
    for (const s of ['Cmaj7', 'F♯m7', 'B♭7', 'Eø7', 'A♭13'])
      for (const level of [1, 2, 3]) {
        const c = parseChord(s)!;
        const pcs = new Set(earVoicing(c, level, rng).map((m) => mod(m, 12)));
        for (const p of pcs) expect(chordPcs(c)).toContain(p);
      }
  });
  it('le 13 se joue sans quinte', () => {
    const c = parseChord('G13')!;
    expect(earVoicing(c, 1).map((m) => mod(m, 12))).not.toContain(2);
  });
  it('construire : quinte facultative sur les accords enrichis', () => {
    const g9 = parseChord('G9')!;
    expect(checkBuild(g9, [59, 65, 69, 67]).ok).toBe(true); // B F A G, sans D
    expect(checkBuild(parseChord('G7')!, [67, 71, 77]).ok).toBe(false); // il manque la quinte
    expect(checkBuild(parseChord('Cmaj7')!, [60, 64, 67, 70]).extra).toEqual([10]);
  });
  it('les progressions se jouent dans toutes les tonalités sans erreur', () => {
    const rng = seeded(4);
    for (let i = 0; i < 200; i++) {
      const q = makeEarQuestion('prog', 1 + (i % 4), {}, undefined, rng);
      expect(q.mode === 'prog' && q.chords.length >= 3).toBe(true);
    }
  });
  it('progressions : les choix ont tous le même nombre d’accords', () => {
    const rng = seeded(8);
    for (let level = 1; level <= 4; level++)
      for (let i = 0; i < 60; i++) {
        const q = makeEarQuestion('prog', level, {}, undefined, rng);
        if (q.mode !== 'prog') throw new Error();
        expect(q.choices).toContain(q.id);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        for (const c of q.choices) expect(PROGRESSIONS[c].steps.length).toBe(q.chords.length);
      }
  });
  it('débutant : majeur ou mineur, 3 sons, et progressions simples', () => {
    const rng = seeded(12);
    for (let i = 0; i < 50; i++) {
      const q = makeEarQuestion('ear', 0, {}, undefined, rng);
      if (q.mode !== 'ear') throw new Error();
      expect(['maj', 'min']).toContain(q.q);
      expect(q.c.notes).toHaveLength(4); // basse + 3 sons
      const p = makeEarQuestion('prog', 0, {}, undefined, rng);
      if (p.mode !== 'prog') throw new Error();
      for (const c of p.chords) expect(['maj', 'min', 'dim']).toContain(c.chord.quality);
    }
  });
});
