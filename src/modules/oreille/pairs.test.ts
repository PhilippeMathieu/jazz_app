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

describe('suites imposées (accompagner une chanson)', () => {
  it('toujours les mêmes choix, jamais 4 fois de suite la même suite, dans le niveau débutant que des suites en 3 sons', async () => {
    const { makeProgSetQuestion, progChoices } = await import('./questions');
    const { PROG_LEVELS } = await import('./data');
    const { PROGRESSIONS } = await import('../../core/theory/progressions');
    const { seeded } = await import('../../core/random');
    const rng = seeded(4);
    const set = ['I-IV', 'I-V', 'I-vi'];
    const recent: string[] = [];
    for (let i = 0; i < 60; i++) {
      const q = makeProgSetQuestion(set, {}, recent, [], rng);
      if (q.mode !== 'prog') throw new Error('mode');
      expect(q.choices).toEqual(set);
      expect(q.chords.length).toBe(2);
      recent.push(q.id);
      const r = recent.slice(-4);
      expect(r.length === 4 && r.every((x) => x === r[0])).toBe(false);
    }
    // Niveau débutant : des accords de 3 sons, et des choix de même longueur (pas de doublon « avec 7es »).
    for (const id of PROG_LEVELS[0]) {
      expect(PROGRESSIONS[id].steps.every((s) => s[2] === 'maj' || s[2] === 'min'), id).toBe(true);
      for (const c of progChoices(id, 0, rng)) expect(PROGRESSIONS[c].steps.length).toBe(PROGRESSIONS[id].steps.length);
    }
  });
});
