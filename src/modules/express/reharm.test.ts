import { describe, expect, it } from 'vitest';
import { REHARM_LEVELS, RTYPE_LABEL, RType, makeReharm } from './reharm';
import { chordSymbol, rootPc } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { seeded } from '../../core/random';

const at = (q: ReturnType<typeof makeReharm>) => q.after.map(chordSymbol).join(' ');

describe('réharmoniser', () => {
  it('en C : les réponses attendues', () => {
    const c = (type: RType) => {
      for (let s = 0; s < 200; s++) {
        const q = makeReharm(1, {}, seeded(s * 104729 + 1), type);
        if (q.key.tonic.letter === 0 && q.key.tonic.acc === 0) return q;
      }
      throw new Error('pas de C');
    };
    expect(c('subv').answer).toBe('D♭7');
    expect(at(c('subv'))).toBe('Dm7 D♭7 Cmaj7');
    expect(c('subvBack').answer).toBe('G7');
    expect(c('iivSub').answer).toBe('A♭m7 D♭7');
    expect(c('iivChrom').answer).toBe('E♭m7 A♭7');
    expect(at(c('iivChrom'))).toBe('E♭m7 A♭7 Dm7 G7 Cmaj7');
  });

  it('dans toutes les tonalités : réponse parmi les choix, choix distincts, réponses justes', () => {
    for (let level = 0; level < REHARM_LEVELS.length; level++)
      for (let s = 0; s < 120; s++) {
        const q = makeReharm(level, {}, seeded(s * 7 + level));
        expect(q.choices).toContain(q.answer);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.choices.length).toBeGreaterThanOrEqual(3);
        const t = mod(rootPc(q.after[0]) - 0, 12);
        void t;
        if (q.type === 'dim') {
          // Le diminué monte d'un demi-ton vers l'accord suivant.
          const d = q.after[1];
          expect(mod(rootPc(q.after[2]) - rootPc(d), 12)).toBe(1);
          // Aucun autre choix n'est le même accord (les °7 se répètent tous les 3 demi-tons).
          for (const ch of q.choices) if (ch !== q.answer) expect(mod(rootPc({ root: d.root, quality: 'dim7' }) - rootPc(q.after[1]), 3)).toBe(0), void ch;
        }
        if (q.type === 'secdom') {
          const target = q.before[q.focus[0]];
          const domIdx = q.after.findIndex((c) => chordSymbol(c) === q.answer);
          expect(mod(rootPc(q.after[domIdx]) - rootPc(target), 12)).toBe(7);
          expect(chordSymbol(q.after[domIdx + 1])).toBe(chordSymbol(target));
        }
        expect(q.explain.length).toBeGreaterThan(20);
        expect(RTYPE_LABEL[q.type]).toBeTruthy();
      }
  });

  it('diminués : les autres choix ne sont pas le même accord', () => {
    for (let s = 0; s < 100; s++) {
      const q = makeReharm(2, {}, seeded(s * 7919 + 3), "dim");
      const cls = (sym: string) => {
        const m = /^([A-G][♭♯]?)°7$/.exec(sym);
        if (!m) throw new Error(sym);
        const pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1][0] as 'C'] + (m[1][1] === '♯' ? 1 : m[1][1] === '♭' ? -1 : 0);
        return mod(pc, 3);
      };
      for (const ch of q.choices) if (ch !== q.answer) expect(cls(ch)).not.toBe(cls(q.answer));
    }
  });
});
