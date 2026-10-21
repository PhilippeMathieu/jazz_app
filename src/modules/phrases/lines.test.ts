import { beforeAll, describe, expect, it } from 'vitest';
import { CYCLE, LINES, matchPhrase, phraseIn, phraseLength } from './lines';
import { QUALITIES, rootPc } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { midiOf } from '../../core/theory/staff';
import { SR, loadSamples, note, seeded } from '../../core/listen/testing/piano';
import { yin } from '../../core/listen/detect';
import { NoteTracker } from '../../core/listen/tracker';

describe('phrases', () => {
  it('3 mesures de 8 croches, notes de l’accord sur les temps', () => {
    for (const l of LINES) {
      const p = phraseIn(l, 0);
      expect(phraseLength(p), l.id).toBe(24);
      for (const n of p.notes) {
        const bar = Math.floor(n.start / 8);
        if (n.start % 2 || bar > 2) continue;
        const c = p.chords[bar];
        const rel = mod(n.midi - rootPc(c), 12);
        const tones = QUALITIES[c.quality].iv.map((x) => mod(x, 12));
        // Sur les temps : notes de l'accord, ou la 9e.
        expect([...tones, 2], `${l.id} : ${n.w.letter}/${n.w.acc} sur ${c.quality}`).toContain(rel);
      }
    }
  });

  it('transposée dans les 12 tonalités : mêmes intervalles, orthographe lisible, registre de main droite', () => {
    for (const l of LINES) {
      const c = phraseIn(l, 0).notes.map((n) => n.midi);
      for (const pc of CYCLE) {
        const p = phraseIn(l, pc);
        const m = p.notes.map((n) => n.midi);
        for (let i = 1; i < m.length; i++) expect(m[i] - m[i - 1]).toBe(c[i] - c[i - 1]);
        expect(mod(m[0] - c[0], 12)).toBe(pc);
        for (const n of p.notes) {
          expect(midiOf(n.w)).toBe(n.midi);
          expect(Math.abs(n.w.acc)).toBeLessThan(2);
          expect(n.midi).toBeGreaterThanOrEqual(53);
          expect(n.midi).toBeLessThanOrEqual(88);
        }
        expect(mod(rootPc(p.chords[2]) - pc, 12)).toBe(0);
      }
    }
  });

  it('comparaison dans l’ordre, à l’octave près', () => {
    expect(matchPhrase([62, 65, 69, 72], [62, 65, 69, 72]).pass).toBe(true);
    expect(matchPhrase([62, 65, 69, 72], [50, 65, 81, 72]).pass).toBe(true); // octaves
    const m = matchPhrase([62, 65, 69, 72], [62, 69, 72]);
    expect(m.ok).toEqual([true, false, true, true]);
    expect(m.pass).toBe(false);
    expect(matchPhrase([62, 65, 69, 72], [62, 61, 65, 69, 72]).pass).toBe(true); // une note en trop
    expect(matchPhrase([62, 65, 69, 72], [62, 69, 65, 72]).pass).toBe(false); // ordre
    expect(matchPhrase([62, 65, 69, 72], [62, 66, 69, 72]).pass).toBe(false); // une note fausse
  });
});

describe('phrases au micro (échantillons de piano)', () => {
  beforeAll(loadSamples, 60000);
  it('reconnaît les phrases jouées legato, une croche = 0,22 s', () => {
    const rng = seeded(5);
    let pass = 0;
    let total = 0;
    for (const l of LINES)
      for (const pc of [0, 5, 10, 3, 8, 1]) {
        const p = phraseIn(l, pc);
        const eighth = 0.22;
        const len = Math.round((p.notes.reduce((s, n) => Math.max(s, n.start + n.dur), 0) * eighth + 0.6) * SR);
        const buf = new Float32Array(len);
        for (const n of p.notes) {
          const at = Math.round(n.start * eighth * SR);
          const d = Math.round(Math.min(n.dur * eighth, 1.2) * SR);
          const x = note(n.midi, d, 0, rng() < 0.5 ? 'p' : 'f');
          const v = 0.5 + 0.5 * rng();
          // Legato : la note s'éteint vite à la note suivante (étouffoir).
          for (let i = 0; i < d && at + i < len; i++) buf[at + i] += v * x[i] * (i > d - 400 ? (d - i) / 400 : 1);
        }
        for (let i = 0; i < len; i++) buf[i] += 0.002 * (rng() * 2 - 1);
        // Comme le micro : une fenêtre de 2048 échantillons toutes les 60 ms.
        const tr = new NoteTracker(0.006);
        const played: number[] = [];
        const hop = Math.round(0.03 * SR);
        for (let s = 2048; s < len; s += hop) {
          const w = buf.subarray(s - 2048, s);
          let e = 0;
          for (let i = 0; i < w.length; i++) e += w[i] * w[i];
          const level = Math.sqrt(e / w.length);
          const ev = tr.push(level > 0.006 ? yin(w, SR, 150, 2200) : null, level, (s / SR) * 1000);
          if (ev) played.push(ev.midi);
        }
        total++;
        if (matchPhrase(p.notes.map((n) => n.midi), played).pass) pass++;
      }
    console.log(`phrases reconnues : ${pass}/${total}`);
    expect(pass / total).toBeGreaterThan(0.85);
  }, 120000);
});
