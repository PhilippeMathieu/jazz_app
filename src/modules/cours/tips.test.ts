import { describe, expect, it } from 'vitest';
import { chordSymbol } from '../../core/theory/chords';
import { seeded } from '../../core/random';
import { TIPS, anotherKey, realize } from './tips';

const tip = (id: string) => TIPS.find((t) => t.id === id)!;
const names = (id: string, pc = 0) => realize(tip(id), pc).line.map((n) => n.name).join(' ');
const degrees = (id: string) => realize(tip(id), 0).line.map((n) => n.degree).join(' ');

describe('astuces', () => {
  it('chaque astuce a une ligne pour chaque accord', () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
    for (const t of TIPS) expect(t.line).toHaveLength(t.chords.length);
  });
  it('les lignes en C sont celles du texte', () => {
    expect(names('7-3')).toBe('C B B');
    expect(names('3-7')).toBe('F F E');
    expect(names('5-b9')).toBe('A A♭ G');
    expect(degrees('5-b9')).toBe('5 ♭9 5');
    expect(names('arpege-3')).toBe('F A C E D B C');
    expect(names('triton')).toBe('F B E C');
    expect(names('13-3')).toBe('E E');
    expect(names('enclosure')).toBe('F D♯ E');
    expect(names('approche')).toBe('A A♯ B');
    expect(names('turn-chrom')).toBe('C C♯ D D');
    expect(names('cascade')).toBe('D C♯ C B B');
    expect(names('subv')).toBe('F F E');
    expect(names('mineur-b9')).toBe('A♭ A♭ G');
    expect(names('backdoor')).toBe('A♭ A♭ G');
    expect(names('iv-ivm')).toBe('A A♭ G');
  });
  it('les accords des exemples en C', () => {
    expect(realize(tip('subv'), 0).chords.map(chordSymbol).join(' ')).toBe('Dm7 D♭7 Cmaj7');
    expect(realize(tip('dim-passage'), 0).chords.map(chordSymbol).join(' ')).toBe('Cmaj7 C♯°7 Dm7 G7');
    expect(realize(tip('mineur-b9'), 0).chords.map(chordSymbol).join(' ')).toBe('Dø7 G7♭9 Cm6');
  });
  it('transposition : jamais de double altération, ligne dans le registre de main droite', () => {
    const rng = seeded(2);
    for (const t of TIPS) {
      let pc = 0;
      for (let i = 0; i < 12; i++) {
        pc = anotherKey(t, pc, rng);
        const r = realize(t, pc);
        const all = [...r.chords.map(chordSymbol), ...r.line.map((n) => n.name)].join(' ');
        expect(all, `${t.id} ${pc}`).not.toMatch(/[𝄫𝄪]/);
        for (const n of r.line) {
          expect(n.midi).toBeGreaterThanOrEqual(67);
          expect(n.midi).toBeLessThanOrEqual(89);
        }
      }
    }
  });
});
