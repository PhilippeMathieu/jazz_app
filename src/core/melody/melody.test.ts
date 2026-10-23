import { beforeAll, describe, expect, it } from 'vitest';
import { Frame, MelNote, replaceRange, toMelody, transcribe } from './melody';
import { SR, loadSamples, note } from '../listen/testing/piano';
import { yin } from '../listen/detect';
import { onsetDetector } from '../listen/onset';
import { seeded } from '../random';

/** Joue une mélodie au piano (vrais échantillons), puis l'écoute comme le micro : hauteur toutes les 40 ms, attaques. */
function listen(mel: { b: number; d: number; m: number }[], spb: number, t0: number, rng: () => number, drums = false) {
  const len = Math.round((t0 + (Math.max(...mel.map((n) => n.b + n.d)) + 1) * spb) * SR);
  const buf = new Float32Array(len);
  for (const n of mel) {
    const at = Math.round((t0 + n.b * spb) * SR);
    const d = Math.round(Math.min(n.d * spb, 1.5) * SR);
    const x = note(n.m, d, 0, rng() < 0.5 ? 'p' : 'f');
    const v = 0.45 + 0.5 * rng();
    for (let i = 0; i < d && at + i < len; i++) buf[at + i] += v * x[i] * (i > d - 400 ? (d - i) / 400 : 1);
  }
  // Charleston de l'accompagnement entendu par le micro : bruit bref sur chaque croche.
  if (drums)
    for (let k = 0; t0 + (k * spb) / 2 < len / SR - 0.1; k++) {
      const at = Math.round((t0 + (k * spb) / 2) * SR);
      for (let i = 0; i < 0.04 * SR; i++) buf[at + i] += 0.02 * (rng() * 2 - 1) * (1 - i / (0.04 * SR));
    }
  for (let i = 0; i < len; i++) buf[i] += 0.002 * (rng() * 2 - 1);
  const frames: Frame[] = [];
  const hop = Math.round(0.04 * SR);
  for (let s = 2048; s < len; s += hop) {
    const w = buf.subarray(s - 2048, s);
    let e = 0;
    for (let i = 0; i < w.length; i++) e += w[i] * w[i];
    const level = Math.sqrt(e / w.length);
    const p = level > 0.006 ? yin(w, SR, 150, 2200) : null;
    frames.push({ t: s / SR, midi: p?.midi ?? null, clarity: p?.clarity ?? 0, level });
  }
  const det = onsetDetector(SR);
  const onsets: number[] = [];
  for (let i = 0; i + 128 <= len; i += 128) {
    const t = det(buf.subarray(i, i + 128), i / SR, 0.006);
    if (t >= 0) onsets.push(t);
  }
  return { frames, onsets };
}

// Un air simple (inventé) : noires, croches, une note répétée, une blanche.
const AIR: MelNote[] = [
  { b: 0, d: 1, m: 67 },
  { b: 1, d: 0.5, m: 69 },
  { b: 1.5, d: 0.5, m: 71 },
  { b: 2, d: 1, m: 72 },
  { b: 3, d: 1, m: 72 },
  { b: 4, d: 0.5, m: 74 },
  { b: 4.5, d: 0.5, m: 72 },
  { b: 5, d: 1, m: 71 },
  { b: 6, d: 2, m: 67 },
  { b: 8, d: 1, m: 64 },
  { b: 9, d: 1, m: 76 },
  { b: 10, d: 2, m: 72 }
];

describe('mélodie jouée au piano', () => {
  beforeAll(loadSamples, 60000);
  for (const [bpm, drums] of [
    [80, false],
    [120, false],
    [100, true]
  ] as const)
    it(`retrouve les notes et leur place, à ${bpm} BPM${drums ? ', batterie dans le micro' : ''}`, () => {
      const spb = 60 / bpm;
      const t0 = 1.3;
      const { frames, onsets } = listen(AIR, spb, t0, seeded(bpm), drums);
      const heard = transcribe(frames, onsets, { gate: 0.006 });
      const mel = toMelody(heard, { anchor: t0, spb }, { latency: 0, shift: 0, from: 0, to: 16 });
      expect(mel.map((n) => n.m)).toEqual(AIR.map((n) => n.m));
      // Au 1/12 de temps près (la grille de quantification), sauf rares écarts d'un cran.
      mel.forEach((n, i) => expect(Math.abs(n.b - AIR[i].b), `note ${i}`).toBeLessThanOrEqual(1 / 12 + 1e-9));
      const exact = mel.filter((n, i) => n.b === AIR[i].b).length;
      expect(exact).toBeGreaterThanOrEqual(AIR.length - 2);
    }, 30000);
});

describe('mélodie swing', () => {
  beforeAll(loadSamples, 60000);
  it('croches swing à 140 BPM : la 2e croche reste sur le 2/3 du temps', () => {
    const swing: MelNote[] = [62, 64, 65, 67, 69, 71, 72, 74].map((m, i) => ({ b: Math.floor(i / 2) + (i % 2 ? 2 / 3 : 0), d: i % 2 ? 1 / 3 : 2 / 3, m }));
    const spb = 60 / 140;
    const { frames, onsets } = listen(swing, spb, 1, seeded(7));
    const mel = toMelody(transcribe(frames, onsets, { gate: 0.006 }), { anchor: 1, spb }, { latency: 0, shift: 0, from: 0, to: 8 });
    expect(mel.map((n) => n.m)).toEqual(swing.map((n) => n.m));
    mel.forEach((n, i) => expect(Math.abs(n.b - swing[i].b), `note ${i}`).toBeLessThanOrEqual(1 / 12 + 1e-9));
  }, 30000);
});

describe('mélodie : calcul', () => {
  it('retranche le retard du micro, transpose, ne garde que la plage enregistrée', () => {
    const heard = [
      { t: 2.08, end: 2.5, midi: 70 },
      { t: 2.58, end: 3.0, midi: 72 },
      { t: 6.1, end: 6.4, midi: 74 }
    ];
    const mel = toMelody(heard, { anchor: 2, spb: 0.5 }, { latency: 0.08, shift: 2, from: 0, to: 8 });
    expect(mel).toEqual([
      { b: 0, d: 10 / 12, m: 68 },
      { b: 1, d: 10 / 12, m: 70 }
    ]);
  });
  it('remplace une section, garde le reste', () => {
    const old: MelNote[] = [0, 1, 4, 5, 9].map((b) => ({ b, d: 1, m: 60 }));
    const r = replaceRange(old, [{ b: 4.5, d: 1, m: 62 }], 4, 8);
    expect(r.map((n) => n.b)).toEqual([0, 1, 4.5, 9]);
  });
  it('silence et bruit : aucune note', () => {
    const rng = seeded(2);
    const frames: Frame[] = Array.from({ length: 50 }, (_, i) => ({ t: i * 0.04, midi: rng() < 0.3 ? 40 + rng() * 40 : null, clarity: rng() * 0.8, level: 0.01 }));
    expect(transcribe(frames, [0.5, 1.0], { gate: 0.006 })).toEqual([]);
  });
});
