import { describe, expect, it } from 'vitest';
import { BASS_HI, BASS_LEVELS, BASS_LO, BASS_NOTES, degreeById, degreeName, judgeBass, makeBassQuestion } from './bassline';
import { mod, pcOf } from '../../core/theory/notes';
import { keyOnPc } from '../../core/chart/model';
import { seeded } from '../../core/random';

describe('ligne de basse', () => {
  it('lignes : degrés du niveau, notes justes, pas de répétition, tessiture de contrebasse', () => {
    const rng = seeded(5);
    BASS_LEVELS.forEach((lv, level) => {
      for (let i = 0; i < 40; i++) {
        const q = makeBassQuestion(level, {}, [], rng);
        expect(q.degrees).toHaveLength(BASS_NOTES);
        expect(q.notes).toHaveLength(BASS_NOTES);
        q.degrees.forEach((d, k) => {
          expect(lv.ids).toContain(d.id);
          expect(mod(q.notes[k] - pcOf(q.key.tonic), 12)).toBe(d.semis);
          expect(q.notes[k]).toBeGreaterThanOrEqual(BASS_LO);
          expect(q.notes[k]).toBeLessThanOrEqual(BASS_HI);
        });
        if (lv.fromTonic) expect(q.degrees[0].id).toBe('I');
        if (!lv.walking) for (let k = 1; k < BASS_NOTES; k++) expect(q.degrees[k].id).not.toBe(q.degrees[k - 1].id);
        if (lv.walking) {
          // La fondamentale sur le 1 de chaque mesure, et le piano joue.
          const ones = q.events!.filter((e) => e.kind === 'bass' && e.beat % 4 === 0).map((e) => (e.kind === 'bass' ? e.midi : 0));
          expect(ones).toEqual(q.notes);
          expect(q.events!.some((e) => e.kind === 'chord')).toBe(true);
          expect(q.chords).toHaveLength(4);
        }
      }
    });
  });

  it('noms des degrés dans la tonalité', () => {
    const f = keyOnPc(5, 'major');
    expect(degreeName(f, degreeById('IV')!)).toBe('B♭');
    expect(degreeName(f, degreeById('♭II')!)).toBe('G♭');
    expect(degreeName(f, degreeById('♭VII')!)).toBe('E♭');
    expect(degreeName(keyOnPc(7, 'major'), degreeById('VII')!)).toBe('F♯');
  });

  it('correction : écart avec la réponse et mouvements', () => {
    const key = keyOnPc(0, 'major');
    const q = { key, degrees: ['I', 'IV', 'V', 'I'].map((x) => degreeById(x)!), notes: [36, 41, 43, 36], tempo: 100, ref: [] };
    const j = judgeBass(q, ['I', 'V', 'V', 'I']);
    expect(j.ok).toEqual([true, false, true, true]);
    expect(j.notes[0]).toBe('Mesure 2 : IV (F), pas V ; un ton plus bas que ta réponse.');
    expect(j.moves).toEqual(['4te ↑', '2de M ↑', '5te ↓']);
  });
});
