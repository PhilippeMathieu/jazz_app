// Le micro d'un téléphone, sans contrôle de gain : un piano joué doucement doit passer le seuil après amplification.
import { beforeAll, describe, expect, it } from 'vitest';
import { SR, chord, loadSamples, seeded } from './testing/piano';
import { analyzeChordBuffer, checkChord, rms } from './detect';
import { floorOf, gainFor, gateFor, MAX_GAIN, NORM_FLOOR } from './level';
import { lhVoicing } from '../audio/voicing';
import { chordOnPc } from '../theory/chords';
import { mod } from '../theory/notes';

beforeAll(loadSamples, 60000);
const N = 16384;

/** Ce que reçoit l'appli : le piano atténué (volume), plus le souffle du micro. */
function phone(notes: number[], volume: number, noise: number, rng: () => number) {
  const x = chord(notes, N, rng, { noise: 0 });
  for (let i = 0; i < N; i++) x[i] = x[i] * volume + noise * (rng() * 2 - 1);
  return x;
}

describe('niveau du micro', () => {
  it('le bruit de fond se mesure entre les notes', () => {
    const levels = [...Array(80).fill(5e-5), ...Array(70).fill(3e-3)];
    expect(floorOf(levels)).toBeCloseTo(5e-5, 6);
    expect(gainFor(5e-5)).toBeCloseTo(NORM_FLOOR / 5e-5, 3);
    expect(gainFor(0)).toBe(MAX_GAIN);
    expect(gainFor(0.01)).toBe(1);
  });

  it('un piano joué doucement, au téléphone : sous l’ancien seuil fixe, reconnu après amplification', () => {
    const rng = seeded(5);
    const noise = 8e-5; // souffle ≈ −87 dBFS
    const floor = noise / Math.sqrt(3);
    const g = gainFor(floor);
    const gate = gateFor(floor, g);
    let raw = 0;
    let heard = 0;
    let ok = 0;
    let total = 0;
    for (const volume of [0.03, 0.01]) // mezzo-forte, piano (≈ −55 et −65 dBFS)
      for (let pc = 0; pc < 12; pc++)
        for (const q of ['m7', '7', 'maj7']) {
          const v = lhVoicing(chordOnPc(pc, q), 'A');
          const x = phone(v, volume, noise, rng);
          raw = Math.max(raw, rms(x));
          for (let i = 0; i < N; i++) x[i] *= g;
          total++;
          if (rms(x) > gate) heard++;
          const target = [...new Set(v.map((m) => mod(m, 12)))];
          const a = analyzeChordBuffer(x, SR);
          if (checkChord(a.chroma, target, [], a.soft).ok) ok++;
        }
    console.log(`brut max ${raw.toFixed(4)} · gain ×${g.toFixed(0)} · seuil ${gate.toFixed(4)} · entendus ${heard}/${total} · reconnus ${ok}/${total}`);
    expect(raw).toBeLessThan(0.006); // l'ancien seuil fixe : rien n'aurait été entendu
    expect(heard).toBe(total);
    expect(ok / total).toBeGreaterThan(0.9);
  }, 60000);

  it('le silence reste du silence', () => {
    const rng = seeded(9);
    const noise = 8e-5;
    const floor = noise / Math.sqrt(3);
    const g = gainFor(floor);
    const x = new Float32Array(N);
    for (let i = 0; i < N; i++) x[i] = g * noise * (rng() * 2 - 1);
    expect(rms(x)).toBeLessThan(gateFor(floor, g));
    expect(rms(x)).toBeLessThan(gateFor(floor, g, 1.5));
  });
});
