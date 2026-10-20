import { describe, expect, it } from 'vitest';
import { RHYTHMS, countOf, gridOf, rhythmById, swingRatio, tickToBeat } from './patterns';
import { calibrate, countInHits, drift, scoreTiming, tolerance } from './timing';
import { GROOVES, STYLE_ORDER } from './styles';

describe('rythmes', () => {
  it('motifs valides et grilles lisibles', () => {
    expect(new Set(RHYTHMS.map((r) => r.id)).size).toBe(RHYTHMS.length);
    for (const r of RHYTHMS) {
      const g = gridOf(r);
      expect(g.filter((c) => c.on)).toHaveLength(r.hits.length);
    }
    expect(countOf(rhythmById('s-charleston')!)).toBe('1, et de 2');
    expect(countOf(rhythmById('k-son32')!)).toBe('mesure 1 : 1, et de 2, 4 ; mesure 2 : 2, 3');
    expect(gridOf(rhythmById('n-4')!).map((c) => c.label).join(' ')).toBe('1 et 2 et 3 et 4 et');
  });
  it('swing : la croche du « et » tombe au 2e tiers, droite pour les claves', () => {
    const ch = rhythmById('s-charleston')!;
    expect(tickToBeat(18, 'swing', 120, ch)).toBeCloseTo(1 + 2 / 3);
    expect(tickToBeat(18, 'straight', 120, ch)).toBeCloseTo(1.5);
    expect(tickToBeat(18, 'swing', 120, rhythmById('k-son32')!)).toBeCloseTo(1.5);
    expect(tickToBeat(8, 'swing', 120, rhythmById('t-let')!)).toBeCloseTo(2 / 3);
    expect(swingRatio(250)).toBeLessThan(swingRatio(120));
  });
  it('mesure des écarts : juste, en avance, raté, en trop', () => {
    const targets = [1, 1.5, 2, 2.5];
    const hits = [1.01, 1.46, 2.3, 2.51, 3.2];
    const r = scoreTiming(targets, hits, 40);
    expect(r.matches.map((m) => m.dev)).toEqual([10, -40, null, 10]);
    expect(r.good).toBe(3);
    expect(r.extra).toBe(2);
    // La calibration retranche la latence.
    expect(scoreTiming([1, 2], [1.08, 2.08], 30, 80).matches.map((m) => m.dev)).toEqual([0, 0]);
  });
  it('calibration et dérive', () => {
    const clicks = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
    expect(calibrate(clicks, clicks.map((c, i) => c + 0.07 + (i % 2 ? 0.01 : -0.01)))).toBeGreaterThanOrEqual(60);
    expect(calibrate(clicks, [0.07])).toBeNull();
    // Casque Bluetooth : 280 ms de retard, clics à 72 BPM.
    const slow = Array.from({ length: 8 }, (_, i) => i * (60 / 72));
    expect(calibrate(slow, slow.map((c) => c + 0.28))).toBe(280);
    // Au micro : attaques pendant le décompte = le micro entend le haut-parleur.
    expect(countInHits([-1.9, -1.4, -0.9, -0.4, 0.01], 0, 0.5)).toBe(4);
    expect(countInHits([0.01, 0.5], 0, 0.5)).toBe(0);
    // Attaques de plus en plus en avance : on accélère.
    const beats = Array.from({ length: 16 }, (_, i) => i * 0.5);
    const rushing = scoreTiming(beats, beats.map((b, i) => b - i * 0.004), 60);
    expect(drift(rushing.matches, 0.5)).toBeGreaterThan(0);
    expect(tolerance(300)).toBeLessThan(tolerance(100));
  });
  it('styles : chaque groove a ses indices et une batterie dans la mesure', () => {
    for (const id of STYLE_ORDER) {
      const g = GROOVES[id];
      expect(g.cues.length).toBeGreaterThanOrEqual(3);
      for (const bar of g.drums) for (const [o] of bar) expect(o).toBeLessThan(g.meter);
      expect(g.defaultTempo).toBeGreaterThanOrEqual(g.tempo[0]);
      expect(g.defaultTempo).toBeLessThanOrEqual(g.tempo[1]);
    }
  });
});
