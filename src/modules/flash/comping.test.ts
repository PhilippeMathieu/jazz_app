import { beforeAll, describe, expect, it } from 'vitest';
import { COMP_LEVELS, Snapshot, evaluate, makeRound, tickBeat } from './comping';
import { chordSymbol } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { SR, loadSamples, note, seeded } from '../../core/listen/testing/piano';
import { onsetDetector } from '../../core/listen/onset';
import { analyzeChordBuffer } from '../../core/listen/detect';

describe('comping : grille et motifs', () => {
  it('ii–V–I–I deux fois, voicings enchaînés, anticipations sur l’accord suivant', () => {
    const r = makeRound(3, 'AB', 0, seeded(1));
    expect(r.chords.map(chordSymbol).join(' ')).toBe('Dm7 G7 Cmaj7 Cmaj7 Dm7 G7 Cmaj7 Cmaj7');
    for (const h of r.hits) {
      const inBar = h.tick % 48;
      // Le « et » de 4 d'un motif anticipé vise l'accord suivant.
      if (inBar === 42) expect(h.chord).toBe(h.bar + 1);
      else expect(h.chord).toBe(h.bar);
    }
    // Pas d'anticipation au-delà de la grille.
    expect(Math.max(...r.hits.map((h) => h.chord))).toBeLessThan(8);
    for (const lv of COMP_LEVELS.keys()) expect(makeRound(lv, 'shell', 5, seeded(lv)).hits.length).toBeGreaterThan(8);
  });
});

describe('comping au micro (échantillons de piano)', () => {
  beforeAll(loadSamples, 60000);

  /** Joue la grille (accords tenus jusqu'à l'attaque suivante), puis l'écoute comme le micro : attaques et chromas. */
  function take(level: number, wrongAt: number[], rng: () => number, tonic = 0) {
    const tempo = 120;
    const spb = 60 / tempo;
    const r = makeRound(level, 'AB', tonic, rng);
    const start = 0.5;
    const targets = r.hits.map((h) => start + tickBeat(h.tick, tempo) * spb);
    const len = Math.round((start + r.bars * 4 * spb + 1) * SR);
    const buf = new Float32Array(len);
    r.hits.forEach((h, i) => {
      const at = Math.round((targets[i] + (rng() - 0.5) * 0.03) * SR);
      const end = i + 1 < targets.length ? Math.round(targets[i + 1] * SR) : at + Math.round(0.8 * SR);
      const d = Math.min(end - at, Math.round(1.4 * SR));
      const notes = [...r.voicings[h.chord]];
      if (wrongAt.includes(i)) notes[1] += 1;
      for (const m of notes) {
        const x = note(m, d, 0, 'p');
        const v = 0.5 + 0.3 * rng();
        for (let k = 0; k < d && at + k < len; k++) buf[at + k] += v * x[k] * (k > d - 600 ? (d - k) / 600 : 1);
      }
    });
    for (let i = 0; i < len; i++) buf[i] += 0.002 * (rng() * 2 - 1);
    const det = onsetDetector(SR);
    const onsets: number[] = [];
    for (let i = 0; i + 128 <= len; i += 128) {
      const t = det(buf.subarray(i, i + 128), i / SR, 0.006);
      if (t >= 0) onsets.push(t);
    }
    const snaps: Snapshot[] = [];
    for (let s = 16384; s < len; s += Math.round(0.06 * SR)) { const a = analyzeChordBuffer(buf.subarray(s - 16384, s), SR); snaps.push({ t: s / SR, chroma: a.chroma, soft: a.soft }); }
    return { r, res: evaluate(r, targets, onsets, snaps, 60, 0, false) };
  }

  it('juste : placement et accords reconnus', () => {
    const rng = seeded(9);
    for (const level of [0, 1, 3]) {
      const { r, res } = take(level, [], rng);
      console.log(`niveau ${level + 1} : ${res.timeOk}/${r.hits.length} en place, ${res.chordOk} accords justes, ${res.bothOk} les deux`);
      expect(res.timeOk / r.hits.length).toBeGreaterThanOrEqual(0.8);
      expect(res.chordOk / r.hits.length).toBeGreaterThanOrEqual(0.8);
    }
  }, 120000);

  it('une note fausse : l’accord est refusé', () => {
    const rng = seeded(4);
    const wrong = [1, 4, 7];
    const { res } = take(1, wrong, rng);
    const refused = wrong.filter((i) => res.hits[i].chordOk === false).length;
    expect(refused).toBeGreaterThanOrEqual(2);
    for (const i of wrong) if (res.hits[i].chordOk === false) expect(res.hits[i].missing.length + res.hits[i].extra.length).toBeGreaterThan(0);
    void mod;
  }, 60000);
});
