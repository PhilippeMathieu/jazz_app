import { describe, expect, it } from 'vitest';
import { chain, moves, spellIn } from './rh';
import { parseChord } from '../theory/chords';
import { LIBRARY, POP, chartById } from '../../library/charts';
import { improvPlan } from './improv';
import { storyOf } from './story';
import { degreeChoices, degreeTargets, scaleChords } from '../../modules/grilles/Story';

const chords = (s: string) => s.split(' ').map((x) => parseChord(x)!);
const names = (v: number[][], cs = chords('C G Am F')) => v.map((x, i) => x.map((m) => spellIn(cs[i], m)).join(' '));

describe('au piano : enchaîner sans sauter', () => {
  it('I – V – vi – IV : la main droite fait de petits pas', () => {
    const v = chain(chords('C G Am F'), ['I', 'V', 'vi', 'IV'], 'simple');
    expect(names(v)).toEqual(['C E G', 'B D G', 'C E A', 'C F A']);
    expect(moves(v[0], v[1], parseChord('C')!, parseChord('G')!)).toEqual({ stay: ['G'], go: ['C ↓ ½ ton → B', 'E ↓ 1 ton → D'] });
    // Jamais plus d'un ton par voix, d'un accord à l'autre.
    for (let i = 1; i < v.length; i++) v[i].forEach((m, j) => expect(Math.abs(m - v[i - 1][j])).toBeLessThanOrEqual(2));
  });
  it('avec les 7es : ii – V – I comme en jazz', () => {
    const cs = chords('Dm G C');
    expect(names(chain(cs, ['ii', 'V', 'I'], 'couleurs'), cs)).toEqual(['D F A C', 'D F G B', 'C E G B']);
  });
  it('orthographe dans l’accord : G♯ dans E7, A♭ dans Fm', () => {
    expect(spellIn(parseChord('E7')!, 68)).toBe('G♯');
    expect(spellIn(parseChord('Fm')!, 68)).toBe('A♭');
    expect(spellIn(parseChord('B°7')!, 68)).toBe('A♭');
  });
  it('toutes les grilles : des voicings de 3 ou 4 notes, dans la main', () => {
    for (const c of [...LIBRARY, ...POP]) {
      const p = improvPlan(c);
      const cs = p.flat.map((f) => f.chord);
      for (const color of ['simple', 'couleurs'] as const)
        for (const v of chain(cs, cs.map(() => ''), color)) {
          expect(v.length, c.id).toBe(color === 'simple' ? 3 : 4);
          expect(v[0], c.id).toBeGreaterThanOrEqual(53);
          expect(v[v.length - 1] - v[0], c.id).toBeLessThanOrEqual(12);
        }
    }
  });
});

describe('degrés d’une phrase', () => {
  it('les accords de la gamme', () => {
    const p = chartById('let-it-be')!;
    expect(scaleChords(p.key).map((x) => `${x.name}=${x.deg}`).join(' ')).toBe('C=I Dm=ii Em=iii F=IV G=V Am=vi B°=vii°');
  });
  it('chaque accord a une réponse parmi les choix ; hors gamme repérés', () => {
    for (const c of [...LIBRARY, ...POP]) {
      const p = improvPlan(c);
      const s = storyOf(c, p.flat, p.analysis, p.scales);
      for (const ph of s.phrases) for (const t of degreeTargets(p, ph)) expect(degreeChoices(ph.key), `${c.id} ${t.sym}`).toContain(t.answer);
    }
    const c = chartById('let-it-be')!;
    const p = improvPlan(c);
    const s = storyOf(c, p.flat, p.analysis, p.scales);
    expect(degreeTargets(p, s.phrases[0]).map((t) => `${t.sym}:${t.answer}`)).toEqual(['C:I', 'G:V', 'Am:vi', 'F:IV']);
    const fin = s.phrases[s.phrases.length - 1];
    expect(degreeTargets(p, fin).find((t) => t.sym === 'B♭')?.answer).toBe('hors');
  });
});
