// Outils de test : rend des notes et des accords à partir des vrais échantillons de piano.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MPEGDecoder } from 'mpg123-decoder';

const NAMES: [string, number][] = [
  ['A1', 33], ['C2', 36], ['Ds2', 39], ['Fs2', 42], ['A2', 45], ['C3', 48], ['Ds3', 51], ['Fs3', 54], ['A3', 57], ['C4', 60], ['Ds4', 63],
  ['Fs4', 66], ['A4', 69], ['C5', 72], ['Ds5', 75], ['Fs5', 78], ['A5', 81], ['C6', 84], ['Ds6', 87], ['Fs6', 90], ['A6', 93], ['C7', 96]
];
export const SR = 44100;
const cache = new Map<number, Float32Array>();

export async function loadSamples() {
  if (cache.size) return;
  const dec = new MPEGDecoder();
  await dec.ready;
  for (const [name, midi] of NAMES) {
    const buf = readFileSync(resolve(__dirname, '../../../../public/samples/piano', name + '.mp3'));
    const r = dec.decode(new Uint8Array(buf));
    const [l, rr] = r.channelData;
    const mono = new Float32Array(Math.min(r.samplesDecoded, SR * 2));
    for (let i = 0; i < mono.length; i++) mono[i] = 0.5 * (l[i] + (rr ? rr[i] : l[i]));
    cache.set(midi, mono);
    await dec.reset();
  }
  dec.free();
}

/** Note MIDI rendue (rééchantillonnage depuis l'échantillon le plus proche). */
export function note(m: number, len: number, offset = 0.15): Float32Array {
  let best = NAMES[0][1];
  for (const [, s] of NAMES) if (Math.abs(s - m) < Math.abs(best - m)) best = s;
  const src = cache.get(best)!;
  const ratio = Math.pow(2, (m - best) / 12);
  const out = new Float32Array(len);
  const start = offset * SR * ratio;
  for (let i = 0; i < len; i++) {
    const x = start + i * ratio;
    const j = Math.floor(x);
    const f = x - j;
    out[i] = j + 1 < src.length ? src[j] * (1 - f) + src[j + 1] * f : 0;
  }
  return out;
}

/** Mélange de notes, vélocités variables, bruit et coupure des graves (micro de téléphone). */
export function chord(notes: number[], len: number, rng: () => number, opts: { noise?: number; highpass?: number } = {}): Float32Array {
  const out = new Float32Array(len);
  for (const m of notes) {
    const v = 0.6 + 0.4 * rng();
    const x = note(m, len, 0.1 + 0.15 * rng());
    for (let i = 0; i < len; i++) out[i] += v * x[i];
  }
  const noise = opts.noise ?? 0.002;
  for (let i = 0; i < len; i++) out[i] += noise * (rng() * 2 - 1);
  const hp = opts.highpass ?? 120;
  if (hp > 0) {
    // Passe-haut du premier ordre
    const rc = 1 / (2 * Math.PI * hp);
    const a = rc / (rc + 1 / SR);
    let py = 0;
    let px = 0;
    for (let i = 0; i < len; i++) {
      const y = a * (py + out[i] - px);
      px = out[i];
      out[i] = y;
      py = y;
    }
  }
  return out;
}

export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
