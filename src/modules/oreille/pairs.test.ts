import { describe, expect, it } from 'vitest';
import { changeText, changes, pairCue, PAIRS } from './pairs';
import { chordOnPc } from '../../core/theory/chords';
import { noteName } from '../../core/theory/notes';

const C = chordOnPc(0, 'maj7').root;
const txt = (a: string, b: string) => changes(C, a, b).map(changeText).join(' ; ');

describe('comparer deux natures', () => {
  it('la chaîne : une seule note baisse d’un demi-ton à chaque fois', () => {
    expect(txt('maj7', '7')).toBe('la 7e : B → B♭ (un demi-ton plus bas)');
    expect(txt('7', 'm7')).toBe('la 3ce : E → E♭ (un demi-ton plus bas)');
    expect(txt('m7', 'm7b5')).toBe('la 5te : G → G♭ (un demi-ton plus bas)');
    expect(txt('m7b5', 'dim7')).toBe('la 7e : B♭ → B𝄫 (un demi-ton plus bas)');
    expect(changes(C, 'maj7', 'm7').map((c) => c.role)).toEqual(['3ce', '7e']);
  });
  it('dans les deux sens, sur toutes les fondamentales', () => {
    for (let pc = 0; pc < 12; pc++) {
      const root = chordOnPc(pc, 'maj7').root;
      for (const [a, b] of PAIRS) {
        const ab = changes(root, a, b);
        const ba = changes(root, b, a);
        expect(ab.length).toBe(ba.length);
        ab.forEach((c, i) => {
          expect(noteName(c.from)).toBe(noteName(ba[i].to));
          expect(c.semis).toBe(-ba[i].semis);
        });
      }
    }
  });
  it('chaque paire a sa façon de l’entendre', () => {
    for (const [a, b] of PAIRS) {
      expect(pairCue(a, b).length).toBeGreaterThan(40);
      expect(pairCue(b, a)).toBe(pairCue(a, b));
    }
  });
});
