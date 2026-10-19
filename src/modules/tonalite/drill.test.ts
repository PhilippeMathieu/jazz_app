import { describe, expect, it } from 'vitest';
import { parseNote } from '../../core/theory/notes';
import { seeded } from '../../core/random';
import { Tally, choicesFor, harmonize, keysFor, makeQuestion } from './drill';

const k = (name: string, mode: 'major' | 'minor') => ({ tonic: parseNote(name)!.note, mode });
const line = (name: string, mode: 'major' | 'minor') => harmonize(k(name, mode)).map((x) => x.symbol).join(' ');

describe('accords de la tonalité', () => {
  it('harmonise le majeur avec la bonne orthographe', () => {
    expect(line('D', 'major')).toBe('Dmaj7 Em7 F♯m7 Gmaj7 A7 Bm7 C♯ø7');
    expect(line('E♭', 'major')).toBe('E♭maj7 Fm7 Gm7 A♭maj7 B♭7 Cm7 Dø7');
    expect(line('G♭', 'major')).toBe('G♭maj7 A♭m7 B♭m7 C♭maj7 D♭7 E♭m7 Fø7');
  });
  it('harmonise le mineur jazz (V7 et VII°7 de l’harmonique)', () => {
    expect(line('A', 'minor')).toBe('Am7 Bø7 Cmaj7 Dm7 E7 Fmaj7 G7 G♯°7');
    expect(line('C', 'minor')).toBe('Cm7 Dø7 E♭maj7 Fm7 G7 A♭maj7 B♭7 B°7');
  });
  it('niveaux : tonalités et réponses proposées', () => {
    expect(keysFor(1)).toHaveLength(7);
    expect(keysFor(2).every((x) => x.mode === 'major')).toBe(true);
    expect(keysFor(3).every((x) => x.mode === 'minor')).toBe(true);
    expect(keysFor(4)).toHaveLength(24);
    expect(choicesFor(1).map((c) => c.sym)).toEqual(['maj7', 'm7', '7', 'ø7']);
    expect(choicesFor(3)).toHaveLength(5);
  });
  it('questions : pas de double altération, jamais deux fois de suite la même', () => {
    const rng = seeded(7);
    let prev: string | undefined;
    for (let i = 0; i < 500; i++) {
      const q = makeQuestion(4, {}, rng, prev);
      expect(Math.abs(q.root.acc)).toBeLessThan(2);
      expect(q.id).not.toBe(prev);
      expect(q.explain).toContain(q.degree.roman.replace(/(Δ7|m7|7|ø7|°7)$/, ''));
      prev = q.id;
    }
  });
  it('les erreurs reviennent plus souvent', () => {
    const tally: Tally = { 'M:D:IIIm7': { c: 0, t: 6 } };
    const rng = seeded(3);
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (makeQuestion(1, tally, rng).id === 'M:D:IIIm7') hits++;
    // 49 couples au N1 : sans pondération ≈ 2 %, ici nettement plus.
    expect(hits / 2000).toBeGreaterThan(0.04);
  });
});
