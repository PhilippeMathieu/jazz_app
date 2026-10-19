import { describe, expect, it } from 'vitest';
import { allTemplates, makeRound, makeSeq } from './drill';
import { chordSymbol } from '../../core/theory/chords';

// Générateur pseudo-aléatoire reproductible
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('analyse express', () => {
  it('construit les séquences avec la bonne orthographe', () => {
    const rng = () => 0.25; // tonalité : pc 3
    const s = makeSeq(3, rng, 'iiVim');
    expect(s.chords.map((c) => chordSymbol(c.chord)).join(' ')).toBe('Fø7 B♭7 E♭m6');
    const b = makeSeq(3, () => 0, 'back');
    expect(b.chords.map((c) => chordSymbol(c.chord)).join(' ')).toBe('Fm7 B♭7 Cmaj7');
  });

  it('chaque question a une seule bonne réponse parmi des choix distincts', () => {
    const rng = seeded(42);
    for (let n = 0; n < 400; n++) {
      const level = 1 + (n % 3);
      for (const q of makeRound(level, rng)) {
        expect(q.choices).toContain(q.answer);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.explain.length).toBeGreaterThan(10);
      }
    }
  });

  it('9 ou ♭9 suit la cible', () => {
    const rng = seeded(7);
    let seen = 0;
    for (let n = 0; n < 300; n++) {
      for (const q of makeRound(3, rng)) {
        if (q.type !== 'nine') continue;
        seen++;
        const t = q.seq.template.id;
        const roman = q.seq.chords[q.focus!].roman;
        if (t === 'iiVim' || t === 'iiVm' || t === 'minTurn' || roman === 'V7/II') expect(q.answer).toBe('♭9');
        if (roman.startsWith('SubV') || roman.startsWith('♭VII') || t === 'iiVI') expect(q.answer).toBe('9');
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('les gammes proposées sont cohérentes', () => {
    const rng = seeded(3);
    for (let n = 0; n < 300; n++) {
      for (const q of makeRound(3, rng)) {
        if (q.type !== 'scale') continue;
        const roman = q.seq.chords[q.focus!].roman;
        if (roman === 'IIø7') expect(q.answer).toBe('locrien ♮2');
        if (roman.startsWith('SubV')) expect(q.answer).toBe('lydien ♭7');
        if (roman === 'V7' && q.seq.template.mode === 'minor') expect(q.answer).toBe('mixolydien ♭9 ♭13');
      }
    }
  });

  it('couvre tous les schémas', () => {
    expect(allTemplates.length).toBeGreaterThanOrEqual(12);
  });
});
