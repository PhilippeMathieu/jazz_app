// Détection audio, en fonctions pures (testables hors navigateur) :
// - une note à la fois (YIN), pour la main droite en impro ;
// - les classes de hauteur d'un accord (spectre + saillance des notes), pour vérifier un voicing.

const freqToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);

export function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

// ---------------------------------------------------------------- Note seule

export interface PitchResult {
  freq: number;
  midi: number;
  /** 0..1 : fiabilité (1 - minimum de la différence normalisée). */
  clarity: number;
}

/** YIN (de Cheveigné & Kawahara 2002), avec interpolation parabolique. */
export function yin(buf: Float32Array, sr: number, minFreq = 150, maxFreq = 2200, threshold = 0.15): PitchResult | null {
  const maxTau = Math.min(Math.floor(sr / minFreq), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sr / maxFreq));
  const W = buf.length - maxTau;
  if (W <= 0) return null;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) {
      const x = buf[i] - buf[i + tau];
      s += x * x;
    }
    d[tau] = s;
  }
  // Différence cumulée normalisée
  const cm = new Float32Array(maxTau + 1);
  cm[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    run += d[tau];
    cm[tau] = run > 0 ? (d[tau] * tau) / run : 1;
  }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (cm[t] < threshold) {
      while (t + 1 <= maxTau && cm[t + 1] < cm[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // Pas de creux sous le seuil : on prend le minimum global s'il reste net.
    let best = minTau;
    for (let t = minTau; t <= maxTau; t++) if (cm[t] < cm[best]) best = t;
    if (cm[best] > 0.3) return null;
    tau = best;
  }
  let t = tau;
  if (tau > 1 && tau < maxTau) {
    const a = cm[tau - 1];
    const b = cm[tau];
    const c = cm[tau + 1];
    const den = a + c - 2 * b;
    if (den !== 0) t = tau + (a - c) / (2 * den);
  }
  const freq = sr / t;
  return { freq, midi: freqToMidi(freq), clarity: 1 - cm[tau] };
}

// ---------------------------------------------------------------- Spectre

/** FFT radix 2 en place (re, im), taille puissance de 2. */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k];
        const ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br;
        im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

// Tampons réutilisés d'un appel à l'autre (l'analyse tourne plusieurs fois par seconde).
const work = new Map<number, { win: Float32Array; re: Float32Array; im: Float32Array; mag: Float32Array }>();
function buffers(n: number) {
  let w = work.get(n);
  if (!w) {
    const win = new Float32Array(n);
    for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    w = { win, re: new Float32Array(n), im: new Float32Array(n), mag: new Float32Array(n / 2) };
    work.set(n, w);
  }
  return w;
}

/** Spectre d'amplitude (fenêtre de Hann). buf.length doit être une puissance de 2. Le résultat est réutilisé au prochain appel. */
function magnitude(buf: Float32Array): Float32Array {
  const n = buf.length;
  const { win, re, im, mag } = buffers(n);
  for (let i = 0; i < n; i++) {
    re[i] = buf[i] * win[i];
    im[i] = 0;
  }
  fft(re, im);
  for (let k = 0; k < n / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}

// ---------------------------------------------------------------- Accords

const NOTE_LO = 33; // A1
const NOTE_HI = 100; // E7

/**
 * Énergie par note (MIDI NOTE_LO..NOTE_HI) à partir des pics du spectre,
 * puis retrait des harmoniques qui ne changent pas de classe de hauteur
 * (quinte = 3e harmonique, tierce majeure = 5e, quinte = 6e) attribuables à une note plus grave.
 */
/** Réglages calibrés sur les échantillons de piano (voir detect.test.ts). */
const TUNE = { fifth: 0.55, third: 0.35, fifth2: 0.3 };
/** Part du retrait des harmoniques gardée pour juger les notes attendues (voir analyzeChordBuffer). */
export let SOFT = 0.5;
export const setSoft = (x: number) => (SOFT = x);

function noteEnergies(mag: Float32Array, sr: number, k = 1): Float32Array {
  const n = mag.length * 2;
  const df = sr / n;
  const E = new Float32Array(NOTE_HI + 1);
  let max = 0;
  const k0 = Math.max(2, Math.floor(60 / df));
  const k1 = Math.min(mag.length - 2, Math.ceil(3200 / df));
  for (let k = k0; k <= k1; k++) if (mag[k] > max) max = mag[k];
  if (max <= 0) return E;
  const floor = max * 0.04;
  for (let k = k0; k <= k1; k++) {
    const v = mag[k];
    if (v < floor || v < mag[k - 1] || v < mag[k + 1]) continue;
    // Interpolation parabolique de la fréquence du pic
    const a = mag[k - 1];
    const c = mag[k + 1];
    const den = a + c - 2 * v;
    const p = den !== 0 ? (0.5 * (a - c)) / den : 0;
    const f = (k + p) * df;
    const m = freqToMidi(f);
    const r = Math.round(m);
    if (r < NOTE_LO || r > NOTE_HI || Math.abs(m - r) > 0.3) continue;
    E[r] += v;
  }
  // Harmoniques d'une note grave qui tombent sur une autre classe de hauteur.
  // Les octaves (2e et 4e harmoniques) ne changent pas la classe de hauteur : on les laisse.
  const HARM: [number, number][] = [
    [19, TUNE.fifth], // 3e harmonique : quinte + octave
    [28, TUNE.third], // 5e harmonique : tierce majeure + 2 octaves
    [31, TUNE.fifth2] // 6e harmonique : quinte + 2 octaves
  ];
  for (let m = NOTE_LO; m <= NOTE_HI; m++) {
    const base = E[m];
    if (base <= 0) continue;
    for (const [semi, c] of HARM) {
      const h = m + semi;
      if (h > NOTE_HI) break;
      E[h] = Math.max(0, E[h] - k * c * base);
    }
  }
  return E;
}

/** Chroma normalisé (max = 1). */
function chromaOf(E: Float32Array): Float32Array {
  const ch = new Float32Array(12);
  for (let m = NOTE_LO; m <= NOTE_HI; m++) ch[m % 12] += E[m];
  let max = 0;
  for (const v of ch) max = Math.max(max, v);
  if (max > 0) for (let i = 0; i < 12; i++) ch[i] /= max;
  return ch;
}

/** Note la plus grave nettement présente (MIDI), ou null. */
function lowestNote(E: Float32Array): number | null {
  let max = 0;
  for (const v of E) max = Math.max(max, v);
  if (max <= 0) return null;
  for (let m = NOTE_LO; m <= NOTE_HI; m++) {
    // Fondamentale présente, ou son octave nettement (fondamentale atténuée par le micro).
    if (E[m] >= 0.2 * max) return m;
  }
  return null;
}

export interface ChordCheck {
  ok: boolean;
  /** Classes de hauteur attendues et absentes. */
  missing: number[];
  /** Classes de hauteur entendues en trop. */
  extra: number[];
  /** 0..1 : part de l'énergie sur les notes attendues. */
  score: number;
}

export const LIMITS = { present: 0.18, extra: 0.4, presentSoft: 0.12 };

/**
 * Compare un chroma aux classes de hauteur attendues.
 * optional : notes jouées mais pas exigées (la quinte d'un voicing à deux mains se confond avec l'harmonique 3 de la basse).
 */
export function checkChord(chroma: Float32Array, target: number[], optional: number[] = [], soft: Float32Array = chroma): ChordCheck {
  const O = new Set(optional.map((p) => ((p % 12) + 12) % 12));
  const T = new Set(target.map((p) => ((p % 12) + 12) % 12));
  const missing = [...T].filter((p) => !O.has(p) && soft[p] < (soft === chroma ? LIMITS.present : LIMITS.presentSoft));
  const extra: number[] = [];
  let inT = 0;
  let all = 0;
  for (let p = 0; p < 12; p++) {
    all += chroma[p];
    if (T.has(p) || O.has(p)) inT += chroma[p];
    else if (chroma[p] >= LIMITS.extra) extra.push(p);
  }
  return { ok: missing.length === 0 && extra.length === 0, missing, extra, score: all > 0 ? inT / all : 0 };
}

/** Raccourci : tampon temporel → vérification d'accord. */
export function analyzeChordBuffer(buf: Float32Array, sr: number) {
  const mag = magnitude(buf);
  const E = noteEnergies(mag, sr);
  // Retrait des harmoniques adouci : pour dire si une note attendue est là. Une note dont l'octave porte
  // l'essentiel du son (G3 au piano) disparaîtrait sinon derrière la 3e harmonique d'une note grave (C3).
  const soft = chromaOf(noteEnergies(mag, sr, SOFT));
  return { energies: E, chroma: chromaOf(E), soft, lowest: lowestNote(E) };
}
