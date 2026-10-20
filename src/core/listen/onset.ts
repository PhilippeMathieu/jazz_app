// Détection des attaques (le moment où une note ou un accord est frappé), bloc par bloc.
// Flux spectral : une attaque fait monter l'énergie dans beaucoup de fréquences à la fois,
// une résonance qui décroît ou des battements, non.
// Fonction autonome, sans import ni variable extérieure : sa source est recopiée telle quelle
// dans l'AudioWorklet du micro (voir mic.ts), et testée ici sur les échantillons de piano.

/** Renvoie une fonction (bloc, instant du bloc, seuil) → instant de l'attaque, ou -1. */
/**
 * Réglages (k, floor, riseMin, emph) choisis sur 12 scènes de comping aléatoires (174 attaques, deux couches
 * de vélocité du piano Salamander, attaques espacées de 0,22 à 0,8 s) : 82 % trouvées, 2 fausses, ± 3 ms.
 * Les ratées sont surtout des attaques douces juste après un accord fort.
 */
export function onsetDetector(sampleRate: number, k = 1.4, floor = 3, riseMin = 1.1, emph = 0.9) {
  const W = 1024;
  const H = W / 2;
  const buf = new Float32Array(W);
  let fill = 0;
  const win = new Float32Array(W);
  for (let i = 0; i < W; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (W - 1));
  const re = new Float64Array(W);
  const im = new Float64Array(W);
  let prevMag = new Float64Array(H);
  let mag = new Float64Array(H);
  const lo = Math.floor((60 * W) / sampleRate);
  const hi = Math.min(H, Math.floor((6000 * W) / sampleRate));
  const hist: number[] = [];
  let f1 = 0;
  let f2 = 0;
  let t1 = 0;
  let last = -1;
  let level1 = 0;
  let rise1 = 0;

  function fft() {
    for (let i = 1, j = 0; i < W; i++) {
      let bit = W >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        const a = re[i];
        re[i] = re[j];
        re[j] = a;
        const b = im[i];
        im[i] = im[j];
        im[j] = b;
      }
    }
    for (let len = 2; len <= W; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang);
      const wi = Math.sin(ang);
      for (let i = 0; i < W; i += len) {
        let cr = 1;
        let ci = 0;
        for (let j = 0; j < len / 2; j++) {
          const ar = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
          const ai = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
          re[i + j + len / 2] = re[i + j] - ar;
          im[i + j + len / 2] = im[i + j] - ai;
          re[i + j] += ar;
          im[i + j] += ai;
          const nr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = nr;
        }
      }
    }
  }

  return function (block: Float32Array, t: number, gate: number): number {
    // Fenêtre glissante des W derniers échantillons.
    const n = block.length;
    buf.copyWithin(0, n);
    buf.set(block, W - n);
    fill = Math.min(W, fill + n);
    let e = 0;
    for (let i = W - n; i < W; i++) e += buf[i] * buf[i];
    const level = Math.sqrt(e / n);
    // Montée d'énergie à travers la fenêtre : 2e moitié comparée à la 1re (une résonance qui décroît ne monte pas).
    // Avec emph > 0, on compare la dérivée du signal (les aigus de l'attaque) : une résonance grave forte ne masque plus une attaque douce.
    let e0 = 0;
    let e1 = 0;
    for (let i = 1; i < H; i++) {
      const v = buf[i] - emph * buf[i - 1];
      e0 += v * v;
    }
    for (let i = H; i < W; i++) {
      const v = buf[i] - emph * buf[i - 1];
      e1 += v * v;
    }
    const rise = e1 / (e0 + 1e-9);
    for (let i = 0; i < W; i++) {
      re[i] = buf[i] * win[i];
      im[i] = 0;
    }
    fft();
    let flux = 0;
    for (let b = lo; b < hi; b++) {
      const m = Math.log(1 + 20 * Math.sqrt(re[b] * re[b] + im[b] * im[b]));
      mag[b] = m;
      const d = m - prevMag[b];
      if (d > 0) flux += d;
    }
    const tmp = prevMag;
    prevMag = mag;
    mag = tmp;
    // Seuil adaptatif : moyenne du flux sur ~150 ms.
    const mean = hist.length ? hist.reduce((s, x) => s + x, 0) / hist.length : 0;
    hist.push(flux);
    if (hist.length > Math.round((0.15 * sampleRate) / n)) hist.shift();
    let out = -1;
    // Pic local du flux (le bloc précédent), au-dessus du seuil, avec du son.
    if (fill >= W && f1 > f2 && f1 >= flux && f1 > mean * k + floor && rise1 > riseMin && level1 > gate && t1 - last > 0.09) {
      // Le pic du flux arrive environ une demi-fenêtre après l'attaque (mesuré sur les échantillons).
      out = Math.max(0, t1 - W / 2 / sampleRate);
      last = t1;
    }
    f2 = f1;
    f1 = flux;
    t1 = t;
    level1 = Math.max(level, level1 * 0.5);
    rise1 = rise;
    return out;
  };
}
