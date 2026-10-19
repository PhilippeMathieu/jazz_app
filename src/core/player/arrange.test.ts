import { describe, expect, it } from 'vitest';
import { arrangeChorus, newArrangeState, BASS_HI, BASS_LO } from './arrange';
import { chartById } from '../../library/charts';
import { flatten, parseChart } from '../chart/model';
import { improvPlan } from '../analysis/improv';
import { seeded } from '../random';
import { mod } from '../theory/notes';

const ALL = { bass: true, comp: true, drums: true };
const arrange = (id: string, seed = 1) => {
  const c = chartById(id)!;
  const flat = flatten(c);
  return { c, flat, ev: arrangeChorus(c, flat, improvPlan(c).scales.map((s) => s.scale), ALL, newArrangeState(), seeded(seed)) };
};

describe('arrangement du play-along', () => {
  it('un repère par temps, dans l’ordre', () => {
    for (const id of ['blues-f', 'autumn-leaves', 'blue-bossa', 'rhythm-changes']) {
      const { flat, ev } = arrange(id);
      const total = flat.reduce((s, f) => s + f.beats, 0);
      expect(ev.filter((e) => e.kind === 'pos').length).toBe(total);
      for (let i = 1; i < ev.length; i++) expect(ev[i].beat).toBeGreaterThanOrEqual(ev[i - 1].beat);
    }
  });
  it('basse et accompagnement restent dans leur registre', () => {
    for (const id of ['autumn-leaves', 'all-the-things', 'blue-bossa']) {
      for (const e of arrange(id, 3).ev) {
        if (e.kind === 'bass') {
          expect(e.midi).toBeGreaterThanOrEqual(BASS_LO);
          expect(e.midi).toBeLessThanOrEqual(BASS_HI);
        }
        if (e.kind === 'chord') for (const n of e.notes) expect(n >= 50 && n <= 74).toBe(true);
      }
    }
  });
  it('le piano joue ♭9 ♭13 sur une dominante qui va vers le mineur', () => {
    const { flat, ev } = arrange('autumn-leaves');
    const d7 = flat.findIndex((f) => f.chord.quality === '7b9');
    const start = flat[d7].start;
    const hit = ev.find((e) => e.kind === 'chord' && e.beat >= start && e.beat < start + 4);
    expect(hit && hit.kind === 'chord' && hit.notes.map((n) => mod(n, 12))).not.toContain(11); // pas de si bécarre sur D7♭9 → Gm
  });
  it('la bossa joue sans swing, la walking bass en noires', () => {
    const { ev } = arrange('blue-bossa');
    expect(ev.some((e) => e.kind === 'hat' && Math.abs((e.beat % 1) - 0.5) < 1e-9)).toBe(true);
    const sw = arrange('autumn-leaves').ev.filter((e) => e.kind === 'bass');
    expect(sw.every((e) => Number.isInteger(e.beat))).toBe(true);
  });
  it('accepte une grille d’un seul accord', () => {
    const c = parseChart('key: C\n| Cmaj7 |');
    const ev = arrangeChorus(c, flatten(c), ['ionien'], ALL, newArrangeState(), seeded(1));
    expect(ev.filter((e) => e.kind === 'pos').length).toBe(4);
  });
});
