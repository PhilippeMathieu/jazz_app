import { describe, expect, it } from 'vitest';
import { isRight, makeRound, makeSeq } from './drill';
import { chordSymbol } from '../../core/theory/chords';
import { seeded } from '../../core/random';

const rounds = (level: number, n: number, seed: number) => {
  const rng = seeded(seed);
  return Array.from({ length: n }, () => makeRound(level, rng)).flat();
};

describe('analyse express', () => {
  it('construit les séquences avec la bonne orthographe', () => {
    const s = makeSeq(3, () => 0.25, 'iiVim'); // pc 3 : E♭ mineur
    expect(s.chords.map((c) => chordSymbol(c.chord)).join(' ')).toBe('Fø7 B♭7 E♭m6');
    expect(s.chords[1].roman).toBe('V7');
    const b = makeSeq(3, () => 0, 'back');
    expect(b.chords.map((c) => chordSymbol(c.chord)).join(' ')).toBe('Fm7 B♭7 Cmaj7');
  });

  it('chaque question a des choix distincts dont la bonne réponse', () => {
    for (const level of [1, 2, 3])
      for (const q of rounds(level, 150, level)) {
        expect(q.choices).toContain(q.answer);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.explain.length).toBeGreaterThan(10);
      }
  });

  it('une seule réponse juste parmi les choix (l’alternative n’est pas un piège)', () => {
    for (const q of rounds(3, 300, 11)) expect(q.choices.filter((c) => isRight(q, c)).length).toBe(1);
  });

  it('9 ou ♭9 suit la cible', () => {
    let seen = 0;
    for (const q of rounds(3, 300, 7)) {
      if (q.type !== 'nine') continue;
      seen++;
      const t = q.seq.template.id;
      const roman = q.seq.chords[q.focus!].roman;
      if (['iiVim', 'iiVm', 'minTurn'].includes(t) || roman === 'V7/II') expect(q.answer).toBe('♭9');
      if (roman.startsWith('SubV') || roman.startsWith('♭VII') || t === 'iiVI') expect(q.answer).toBe('9');
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('les gammes proposées sont cohérentes', () => {
    for (const q of rounds(3, 300, 3)) {
      if (q.type !== 'scale') continue;
      const roman = q.seq.chords[q.focus!].roman;
      if (roman === 'IIø7') expect(isRight(q, 'locrien') && isRight(q, 'locrien ♮2')).toBe(true);
      if (roman.startsWith('SubV')) expect(q.answer).toBe('lydien ♭7');
      if (roman === 'V7' && q.seq.template.mode === 'minor') expect(q.answer).toBe('mixolydien ♭9 ♭13');
    }
  });

  it('la tonalité n’est demandée que s’il y a un ii–V, et sans la tonalité homonyme', () => {
    for (const q of rounds(3, 300, 5)) {
      if (q.type !== 'key') continue;
      expect(q.seq.chords.some((c) => c.roman === 'V7')).toBe(true);
      const [tonic, mode] = q.answer.split(' ');
      expect(q.choices).not.toContain(`${tonic} ${mode === 'majeur' ? 'mineur' : 'majeur'}`);
    }
  });

  it('les enchaînements ratés reviennent plus souvent', () => {
    const rng = seeded(9);
    const templates = { iiVI: { c: 0, t: 20 }, iiV: { c: 20, t: 20 }, turn1: { c: 20, t: 20 }, turn3: { c: 20, t: 20 } };
    let iiVI = 0;
    for (let n = 0; n < 400; n++) if (makeSeq(1, rng, undefined, templates).template.id === 'iiVI') iiVI++;
    expect(iiVI / 400).toBeGreaterThan(0.4);
  });
});
