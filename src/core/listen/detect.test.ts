// Calibration de la détection sur les vrais échantillons de piano (Salamander),
// avec vélocités variables, bruit et coupure des graves façon micro de téléphone.
import { beforeAll, describe, expect, it } from 'vitest';
import { SR, chord, loadSamples, note, seeded } from './testing/piano';
import { analyzeChordBuffer, checkChord, yin } from './detect';
import { US_IDS, lhVoicing, twoHands } from '../audio/voicing';
import { chordOnPc } from '../theory/chords';
import { mod } from '../theory/notes';

beforeAll(loadSamples, 60000);
const N = 16384;
const QUALS = ['maj7', 'm7', '7', 'm7b5', 'dim7', '6', 'm6', '7b9'];

describe('détection', () => {
  it('reconnaît les voicings joués, refuse les faux', () => {
    const rng = seeded(7);
    let good = 0;
    let wrongOk = 0;
    let missOk = 0;
    let total = 0;
    for (const type of ['shell', 'A', 'B'] as const)
      for (let pc = 0; pc < 12; pc++)
        for (const q of QUALS) {
          const v = lhVoicing(chordOnPc(pc, q), type);
          const target = [...new Set(v.map((m) => mod(m, 12)))];
          const ana = (notes: number[]) => analyzeChordBuffer(chord(notes, N, rng), SR).chroma;
          total++;
          if (checkChord(ana(v), target).ok) good++;
          const wrong = [...v];
          wrong[Math.floor(rng() * wrong.length)] += rng() < 0.5 ? 1 : -1;
          if (checkChord(ana(wrong), target).ok) wrongOk++;
          if (checkChord(ana(v.slice(0, -1)), target).ok) missOk++;
        }
    expect(good / total).toBeGreaterThan(0.9);
    expect(wrongOk / total).toBeLessThan(0.03);
    expect(missOk / total).toBeLessThan(0.1);
  }, 120000);

  it('reconnaît les voicings à deux mains (5 notes, 2 octaves et plus)', () => {
    const rng = seeded(11);
    let good = 0;
    let wrongOk = 0;
    let total = 0;
    for (const type of ['spread', 'quartal', 'drop2', 'us'] as const)
      for (let pc = 0; pc < 12; pc++)
        for (const q of type === 'us' ? ['7'] : QUALS) {
          const all = type === 'us' ? US_IDS.map((u) => twoHands(chordOnPc(pc, q), type, null, u).notes) : [twoHands(chordOnPc(pc, q), type).notes];
          for (const v of all) {
            const target = [...new Set(v.map((m) => mod(m, 12)))];
            const fifth = [mod(pc + 7, 12)];
            const ana = (notes: number[]) => analyzeChordBuffer(chord(notes, N, rng), SR).chroma;
            total++;
            if (checkChord(ana(v), target, fifth).ok) good++;
            const wrong = [...v];
            wrong[Math.floor(rng() * wrong.length)] += rng() < 0.5 ? 1 : -1;
            if (checkChord(ana(wrong), target, fifth).ok) wrongOk++;
          }
        }
    console.log(`deux mains : ${good}/${total} reconnus, ${wrongOk} faux acceptés`);
    expect(good / total).toBeGreaterThan(0.85);
    expect(wrongOk / total).toBeLessThan(0.05);
  }, 180000);

  it('signale la note manquante', () => {
    const v = lhVoicing(chordOnPc(0, 'maj7'), 'A'); // E G B D
    const r = analyzeChordBuffer(chord(v.filter((m) => mod(m, 12) !== 11), N, seeded(3)), SR);
    expect(checkChord(r.chroma, [4, 7, 11, 2]).missing).toContain(11);
  });

  it('trouve la note grave', () => {
    const r = analyzeChordBuffer(chord([52, 55, 59, 62], N, seeded(4)), SR);
    expect(r.lowest).toBe(52);
  });

  it('détecte une note seule (main droite)', () => {
    let ok = 0;
    for (let m = 55; m <= 96; m++) {
      const buf = note(m, 2048, 0.2);
      for (let i = 0; i < buf.length; i++) buf[i] += 0.003 * (Math.random() * 2 - 1);
      const p = yin(buf, SR);
      if (p && Math.round(p.midi) === m) ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(40); // sur 42
  });

  it('détecte une note seule dans les graves (lecture en clé de fa), micro de téléphone', () => {
    const rng = seeded(11);
    let ok = 0;
    let n = 0;
    for (let m = 36; m <= 86; m++) {
      const p = yin(chord([m], 3072, rng, { noise: 0.003, highpass: 120 }), SR, 60, 2200);
      n++;
      if (p && Math.round(p.midi) === m) ok++;
    }
    expect(ok).toBe(n); // C2 à D6
  });
});

import { NoteTracker } from './tracker';

describe('suivi des notes', () => {
  const P = (midi: number, clarity = 0.95) => ({ midi, freq: 0, clarity });
  it('confirme une note après deux mesures stables, puis la suivante', () => {
    const tr = new NoteTracker(0.01);
    expect(tr.push(P(60), 0.05, 0)).toBeNull();
    expect(tr.push(P(60.1), 0.05, 60)).toEqual({ midi: 60, t: 60 });
    expect(tr.push(P(60), 0.04, 120)).toBeNull();
    expect(tr.push(P(62), 0.05, 180)).toBeNull();
    expect(tr.push(P(62), 0.05, 240)).toEqual({ midi: 62, t: 240 });
  });
  it('ignore le silence et les mesures peu fiables', () => {
    const tr = new NoteTracker(0.01);
    expect(tr.push(P(60), 0.002, 0)).toBeNull();
    expect(tr.push(P(60, 0.5), 0.05, 60)).toBeNull();
    expect(tr.push(P(60.5), 0.05, 120)).toBeNull();
  });
  it('compte une note rejouée après une nouvelle attaque', () => {
    const tr = new NoteTracker(0.01);
    tr.push(P(64), 0.05, 0);
    expect(tr.push(P(64), 0.05, 60)?.midi).toBe(64);
    expect(tr.push(P(64), 0.02, 120)).toBeNull();
    expect(tr.push(P(64), 0.06, 180)?.midi).toBe(64);
  });
});
