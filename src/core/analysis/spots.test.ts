import { describe, expect, it } from 'vitest';
import { chartById } from '../../library/charts';
import { LIBRARY } from '../../library/charts';
import { flatten, parseChart } from '../chart/model';
import { pcOf } from '../theory/notes';
import { analyze } from './analyze';
import { correct, findSpots } from './spots';

const setup = (id: string) => {
  const c = chartById(id)!;
  const flat = flatten(c);
  const an = analyze(c);
  return { c, flat, an, spots: findSpots(flat, an, c.beatsPerBar) };
};

describe('Analyser : enchaînements à repérer', () => {
  it('Autumn Leaves : ii–V–I en B♭ et ii–V–i en G mineur', () => {
    const { spots } = setup('autumn-leaves');
    const first = spots[0];
    expect(first.type).toBe('iiVI');
    expect(first.from).toBe(0);
    expect(pcOf(first.target.tonic)).toBe(10);
    const minor = spots.find((s) => s.type === 'iiVi')!;
    expect(pcOf(minor.target.tonic)).toBe(7);
  });
  it('Rhythm changes : dominantes secondaires, backdoor vers B♭, turnarounds', () => {
    const { spots } = setup('rhythm-changes');
    expect(spots.some((s) => s.type === 'sec')).toBe(true);
    const back = spots.find((s) => s.type === 'back')!;
    expect(pcOf(back.target.tonic)).toBe(10);
    expect(spots.some((s) => s.type === 'turn' && !s.main)).toBe(true);
  });
  it('pas de faux turnaround sur un cycle de quartes (Fm7 B♭7 E♭maj7 A♭7)', () => {
    const { spots } = setup('rhythm-changes');
    expect(spots.filter((s) => s.type === 'turn').every((s) => pcOf(s.target.tonic) === 10)).toBe(true);
  });
  it('chaque grille : des repères bien formés', () => {
    for (const c of LIBRARY) {
      const flat = flatten(c);
      for (const s of findSpots(flat, analyze(c), c.beatsPerBar)) {
        expect(s.starts).toContain(s.from);
        expect(s.ends).toContain(s.to);
        expect(s.from).toBeLessThan(s.to + 1);
        expect(s.accept).toContain(s.type);
      }
    }
  });
});

describe('Analyser : correction', () => {
  it('juste, mauvaise tonalité, mauvais type, manqué', () => {
    const { flat, an, spots } = setup('autumn-leaves');
    const r = correct(
      [
        { from: 0, to: 2, type: 'iiVI', target: 10 },
        { from: 4, to: 7, type: 'iiVi', target: 2 },
        { from: 8, to: 10, type: 'back', target: 10 }
      ],
      spots,
      flat,
      an
    );
    expect(r.results.map((x) => x.verdict)).toEqual(['ok', 'near', 'bad']);
    expect(r.found).toBe(1);
    // Vus mais mal nommés : expliqués dans leur ligne, pas répétés dans « manqué ».
    expect(r.missed.some((s) => s.from === 8)).toBe(false);
    expect(r.missed.length).toBeGreaterThan(0);
  });
  it('un ii–V–I marqué sans le I, ou appelé ii–V, est accepté', () => {
    const { flat, an, spots } = setup('autumn-leaves');
    const r = correct([{ from: 0, to: 1, type: 'iiV', target: 10 }], spots, flat, an);
    expect(r.results[0].verdict).toBe('ok');
    expect(r.results[0].text).toContain('ii–V–I');
  });
  it('un turnaround trouvé couvre ses ii–V', () => {
    const c = parseChart('key: C\n| Cmaj7 A7 | Dm7 G7 | Cmaj7 A7 | Dm7 G7 |', 't');
    const flat = flatten(c);
    const an = analyze(c);
    const spots = findSpots(flat, an, 4);
    const turn = spots.find((s) => s.type === 'turn')!;
    const r = correct([{ from: turn.from, to: turn.to, type: 'turn', target: 0 }], spots, flat, an);
    expect(r.results[0].verdict).toBe('ok');
    expect(r.missed.filter((s) => s.main && s.from <= turn.to).length).toBe(0);
  });
});
