// Hasard : fonctions communes, avec un générateur injectable pour les tests.
export type Rng = () => number;

export const rndInt = (n: number, rng: Rng = Math.random) => Math.floor(rng() * n);
export const pick = <T,>(a: T[], rng: Rng = Math.random): T => a[Math.floor(rng() * a.length)];

export function shuffle<T>(a: T[], rng: Rng = Math.random): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Tirage pondéré. */
export function weightedPick<T>(items: T[], weight: (x: T) => number, rng: Rng = Math.random): T {
  const w = items.map(weight);
  let r = rng() * w.reduce((s, x) => s + x, 0);
  for (let i = 0; i < items.length; i++) {
    r -= w[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Générateur reproductible (tests). */
export function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
