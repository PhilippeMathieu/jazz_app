import { describe, expect, it } from 'vitest';
import { loadSamples, note, SR } from './testing/piano';
import { onsetDetector } from './onset';
import { seeded } from '../random';

/** Accords frappés aux instants donnés (avec résonance), bruit de fond, passe-haut de téléphone. */
function render(hits: { t: number; notes: number[]; vel: number }[], len: number, rng: () => number) {
  const out = new Float32Array(Math.round(len * SR));
  for (const h of hits) {
    for (const m of h.notes) {
      // Couche de vélocité comme le vrai piano : douce en dessous de 0,55.
      const soft = h.vel < 0.55;
      const x = note(m, Math.round(1.6 * SR), 0, soft ? 'p' : 'f');
      // Mêmes gains que le moteur audio quand il mêle les deux couches.
      const g = soft ? 1.25 : 0.7;
      for (let i = 0; i < x.length; i++) x[i] *= g; const fade = Math.round(0.3 * SR); for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
      const at = Math.round(h.t * SR);
      for (let i = 0; i < x.length && at + i < out.length; i++) out[at + i] += h.vel * x[i];
    }
  }
  for (let i = 0; i < out.length; i++) out[i] += 0.002 * (rng() * 2 - 1);
  return out;
}
function detect(sig: Float32Array, gate = 0.006) {
  const d = onsetDetector(SR);
  const found: number[] = [];
  for (let i = 0; i + 128 <= sig.length; i += 128) {
    const t = d(sig.subarray(i, i + 128), i / SR, gate);
    if (t >= 0) found.push(t);
  }
  return found;
}

describe('attaques au micro', () => {
  it('retrouve les accords frappés, à 15 ms près (la tolérance « en place » est de 30 à 60 ms), sans fausse attaque', async () => {
    await loadSamples();
    const rng = seeded(3);
    // Comping : accords serrés, nuances variées, certains frappés pendant que le précédent résonne.
    const times = [0.3, 0.8, 1.13, 1.8, 2.05, 2.6, 3.0, 3.45, 3.9];
    const chords = [[52, 55, 59, 62], [48, 52, 55, 59], [50, 53, 57, 60], [55, 59, 62, 65]];
    const hits = times.map((t, i) => ({ t, notes: chords[i % chords.length], vel: 0.35 + 0.5 * rng() }));
    const found = detect(render(hits, 4.5, rng));
    // Chaque détection correspond à une attaque (pas de fausse alerte) ; 80 % trouvées au moins (les attaques
    // douces juste après un accord fort peuvent passer inaperçues).
    for (const f of found) expect(Math.min(...times.map((t) => Math.abs(f - t)))).toBeLessThan(0.015);
    expect(found.length).toBeGreaterThanOrEqual(7);
  }, 30000);
  it('notes seules, graves ou aiguës', async () => {
    await loadSamples();
    const rng = seeded(5);
    const times = [0.2, 0.7, 1.2, 1.5, 2.2];
    const hits = times.map((t, i) => ({ t, notes: [[40, 64, 76, 45, 84][i]], vel: 0.6 }));
    const found = detect(render(hits, 3, rng));
    expect(found).toHaveLength(times.length);
    found.forEach((f, i) => expect(Math.abs(f - times[i])).toBeLessThan(0.01));
  }, 30000);
  it('silence : rien', () => {
    const rng = seeded(1);
    const sig = new Float32Array(SR);
    for (let i = 0; i < sig.length; i++) sig[i] = 0.002 * (rng() * 2 - 1);
    expect(detect(sig)).toHaveLength(0);
  });
});
