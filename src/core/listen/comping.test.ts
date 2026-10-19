import { beforeAll, describe, expect, it } from 'vitest';
import { SR, chord, loadSamples } from './testing/piano';
import { analyzeChordBuffer } from './detect';
import { checkComping } from './comping';
import { lhVoicing } from '../audio/voicing';
import { chordOnPc } from '../theory/chords';
import { seeded } from '../random';

beforeAll(loadSamples, 60000);
const N = 16384;

describe('vérification de l’accompagnement', () => {
  it('accepte shells et voicings sans fondamentale, refuse un mauvais accord', () => {
    const rng = seeded(5);
    let ok = 0;
    let wrongOk = 0;
    let total = 0;
    for (let pc = 0; pc < 12; pc++)
      for (const [q, scale] of [['m7', 'dorien'], ['7', 'mixolydien'], ['maj7', 'ionien']] as const)
        for (const type of ['shell', 'A', 'B'] as const) {
          const c = chordOnPc(pc, q);
          const r = analyzeChordBuffer(chord(lhVoicing(c, type), N, rng), SR);
          total++;
          if (checkComping(r.chroma, c, scale).ok) ok++;
          // Accord d'une autre qualité sur la même fondamentale (ex. Cmaj7 au lieu de C7)
          const other = chordOnPc(pc, q === 'maj7' ? '7' : q === '7' ? 'maj7' : 'maj7');
          const r2 = analyzeChordBuffer(chord(lhVoicing(other, type), N, rng), SR);
          if (checkComping(r2.chroma, c, scale).ok) wrongOk++;
        }
    expect(ok / total).toBeGreaterThan(0.85);
    expect(wrongOk / total).toBeLessThan(0.05);
  }, 120000);
});
