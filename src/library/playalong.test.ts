import { describe, expect, it } from 'vitest';
import { VOLUMES, barAt, barLength, chordAt, isCalibrated, matchFile, segChords, segSpan, trackById } from './playalong';
import { chordSymbol } from '../core/theory/chords';

const tracks = VOLUMES.flatMap((v) => v.tracks);

describe('bandes-son', () => {
  it('chaque piste calée : mesures croissantes, accords lisibles, tempo cohérent avec la mesure', () => {
    expect(tracks).toHaveLength(31);
    const cal = tracks.filter(isCalibrated);
    expect(cal.length).toBeGreaterThanOrEqual(18);
    for (const t of cal) {
      const b = t.bars!;
      for (let i = 1; i < b.length; i++) expect(b[i], `${t.track} mesure ${i}`).toBeGreaterThan(b[i - 1]);
      expect(t.segs![0][0]).toBe(0);
      t.segs!.forEach((s, i) => {
        if (i) expect(s[0]).toBeGreaterThan(t.segs![i - 1][0]);
        expect(s[0]).toBeLessThan(b.length);
        expect(segChords(t, i).length, `${t.track} ${s[1]}`).toBe(s[1].split(' ').length);
      });
      expect(Math.abs((60 / t.tempo!) * 4 - barLength(t)) / barLength(t), `${t.track}`).toBeLessThan(0.1);
    }
  });

  it('un cycle : 12 tonalités différentes à la suite', () => {
    const t = trackById('v21-01')!;
    const roots = t.segs!.slice(0, 12).map((s) => s[1].replace(/maj7$/, ''));
    expect(new Set(roots).size).toBe(12);
    expect(roots[0]).toBe('C');
  });

  it('retrouve la piste d’après le nom du fichier', () => {
    expect(matchFile('05. Majeur en Quarte.mp3')?.track).toBe(5);
    expect(matchFile('30. F Blues.mp3')?.title).toBe('Blues en F');
    expect(matchFile('Piste 7.mp3')?.track).toBe(7);
    expect(matchFile('Sans numéro.mp3')).toBeUndefined();
  });

  it('suit la musique : mesure, accord, demi-mesure du blues', () => {
    const t = trackById('v21-30')!;
    const b = t.bars!;
    expect(barAt(t, b[0] - 1)).toBe(-1);
    expect(barAt(t, b[0] + 0.01)).toBe(0);
    // Mesure 4 du blues en F : Cm7 puis F7.
    const len = b[4] - b[3];
    expect(chordSymbol(chordAt(t, b[3] + 0.1 * len).chord!)).toBe('Cm7');
    expect(chordSymbol(chordAt(t, b[3] + 0.8 * len).chord!)).toBe('F7');
    const [a, e] = segSpan(t, 1);
    expect(a).toBe(b[1]);
    expect(e).toBe(b[2]);
  });
});
