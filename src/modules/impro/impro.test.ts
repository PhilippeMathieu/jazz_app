import { describe, expect, it } from 'vitest';
import { IMPRO, barsOf, exampleLine, rhythmBeats, scaleOf, scoreTake } from './impro';
import { chordPcs } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';

const spb = 0.75;
const seeded = (s: number) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

describe('impro guidée', () => {
  it('chaque niveau : boucle lisible, notes permises cohérentes', () => {
    for (const l of Object.values(IMPRO)) {
      expect(barsOf(l)).toHaveLength(l.bars);
      expect(scaleOf(l).every((p) => p >= 0 && p < 12)).toBe(true);
      expect(l.tips.length).toBeGreaterThan(0);
    }
    expect(scaleOf(IMPRO.noires).sort((a, b) => a - b)).toEqual([1, 3, 6, 8, 10]);
  });

  it('les cibles sont jouables : chaque accord a une note de l’accord dans les notes permises', () => {
    for (const l of Object.values(IMPRO).filter((x) => x.target)) {
      for (const c of barsOf(l)) expect(chordPcs(c).some((p) => scaleOf(l).includes(p))).toBe(true);
    }
  });

  it('l’exemple généré réussit son propre niveau', () => {
    for (const l of Object.values(IMPRO)) {
      for (let s = 1; s <= 5; s++) {
        const swing = l.feel === 'swing' ? 0.62 : 0.5;
        const ex = exampleLine(l, swing, seeded(s));
        const notes = ex.map((n) => ({ t: n.beat * spb, midi: n.midi }));
        const r = scoreTake(l, notes, notes.map((n) => n.t), spb, swing);
        // L'exemple reste dans la gamme, respecte les silences, le rythme et les cibles.
        expect(r.inScale, l.id).toBe(100);
        if (l.rests) expect(r.rests, l.id).toBe(100);
        if (l.rhythm) expect(r.rhythm, l.id).toBe(100);
        if (l.target) expect(r.targets, l.id).toBe(100);
        if (l.need.breaths) expect(r.breaths, l.id).toBeGreaterThanOrEqual(l.need.breaths);
        expect(r.notes, l.id).toBeGreaterThanOrEqual(l.need.notes);
        expect(r.ok, `${l.id} ${r.fix.join(' | ')}`).toBe(true);
      }
    }
  });

  it('des notes hors gamme et sans silence : échec expliqué', () => {
    const l = IMPRO.noires;
    // Croches régulières sur les touches blanches : hors gamme, aucune respiration.
    const notes = Array.from({ length: 64 }, (_, i) => ({ t: (i * spb) / 2, midi: 60 + [0, 2, 4, 5][i % 4] }));
    const r = scoreTake(l, notes, [], spb);
    expect(r.inScale).toBe(0);
    expect(r.breaths).toBe(0);
    expect(r.ok).toBe(false);
    expect(r.fix.join(' ')).toMatch(/hors des notes permises/);
    expect(r.fix.join(' ')).toMatch(/silences/);
  });

  it('question-réponse : jouer pendant les mesures de silence est relevé', () => {
    const l = IMPRO.cinq;
    const notes = Array.from({ length: 32 }, (_, i) => ({ t: i * spb, midi: 60 + [0, 2, 4, 7][i % 4] }));
    const r = scoreTake(l, notes, [], spb);
    expect(r.rests).toBe(0);
    expect(r.fix.join(' ')).toMatch(/mesures 3, 4, 7, 8/);
  });

  it('cibles : la note du 1er temps doit être une note de l’accord', () => {
    const l = IMPRO.cibles;
    const chords = barsOf(l);
    const good = chords.map((c, b) => ({ t: b * 4 * spb, midi: 60 + chordPcs(c)[1] }));
    const fill = chords.flatMap((_, b) => [1, 2, 3].map((k) => ({ t: (b * 4 + k) * spb, midi: 62 })));
    expect(scoreTake(l, [...good, ...fill], [], spb).targets).toBe(100);
    const bad = chords.map((c, b) => ({ t: b * 4 * spb, midi: 60 + [0, 2, 4, 5, 7, 9, 11].find((p) => !chordPcs(c).includes(p))! }));
    expect(scoreTake(l, [...bad, ...fill], [], spb).targets).toBe(0);
    expect(bad.every((n, b) => !chordPcs(chords[b]).includes(mod(n.midi, 12)))).toBe(true);
  });

  it('rythme imposé : attaques sur 2 mesures, répétées, avec le swing', () => {
    const beats = rhythmBeats(IMPRO.dorien, 0.6);
    expect(beats.slice(0, 4)).toEqual([0, 1.6, 3, 4]);
    expect(beats).toHaveLength(16);
  });
});
