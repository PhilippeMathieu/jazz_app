// Mesure du placement : attaques (taps à l'écran ou notes au micro) comparées aux temps visés.

export interface Match {
  /** Instant visé (s). */
  target: number;
  /** Écart en ms (négatif = en avance), null si rien n'a été joué. */
  dev: number | null;
}
export interface TimingResult {
  matches: Match[];
  /** Attaques en trop (pas de cible proche). */
  extra: number;
  /** Cibles justes (|écart| ≤ tolérance). */
  good: number;
  /** Écart moyen (ms) : < 0 en avance, > 0 en retard. */
  mean: number;
  /** Régularité : écart-type des écarts (ms). */
  spread: number;
}

/** Tolérance « juste » selon le tempo : 60 ms, resserrée aux tempos rapides (15 % d'une croche). */
export const tolerance = (tempo: number) => Math.min(60, Math.max(30, (60 / tempo / 2) * 1000 * 0.3));

/**
 * Associe chaque cible à l'attaque la plus proche, dans une fenêtre de ± la moitié de l'écart avec
 * la cible voisine (au plus 250 ms). offset (ms) : latence mesurée à la calibration, retranchée.
 */
export function scoreTiming(targets: number[], hits: number[], tolMs: number, offsetMs = 0, maxWin = 0.25): TimingResult {
  const t = [...targets].sort((a, b) => a - b);
  const h = hits.map((x) => x - offsetMs / 1000).sort((a, b) => a - b);
  const used = new Set<number>();
  const matches: Match[] = t.map((target, i) => {
    const gapPrev = i > 0 ? target - t[i - 1] : Infinity;
    const gapNext = i < t.length - 1 ? t[i + 1] - target : Infinity;
    const win = Math.min(maxWin, gapPrev / 2, gapNext / 2);
    let best = -1;
    for (let k = 0; k < h.length; k++) {
      if (used.has(k)) continue;
      const d = h[k] - target;
      if (Math.abs(d) <= win && (best < 0 || Math.abs(d) < Math.abs(h[best] - target))) best = k;
    }
    if (best < 0) return { target, dev: null };
    used.add(best);
    return { target, dev: Math.round((h[best] - target) * 1000) };
  });
  const devs = matches.map((m) => m.dev).filter((d): d is number => d !== null);
  const mean = devs.length ? devs.reduce((s, d) => s + d, 0) / devs.length : 0;
  const spread = devs.length > 1 ? Math.sqrt(devs.reduce((s, d) => s + (d - mean) ** 2, 0) / (devs.length - 1)) : 0;
  return {
    matches,
    extra: h.length - used.size,
    good: devs.filter((d) => Math.abs(d) <= tolMs).length,
    mean: Math.round(mean),
    spread: Math.round(spread)
  };
}

/** Calibration : décalage médian entre les clics et les attaques (latence du téléphone et du geste). */
export function calibrate(clicks: number[], hits: number[]): number | null {
  // Fenêtre large : un casque Bluetooth peut retarder le son de 200 à 300 ms.
  const r = scoreTiming(clicks, hits, 1000, 0, 0.42);
  const devs = r.matches.map((m) => m.dev).filter((d): d is number => d !== null).sort((a, b) => a - b);
  if (devs.length < Math.max(4, clicks.length * 0.6)) return null;
  // On écarte les extrêmes : médiane des écarts du milieu.
  return devs[Math.floor(devs.length / 2)];
}

/** Attaques entendues pendant le décompte (où l'élève ne joue pas) : au micro, signe qu'il capte le haut-parleur. */
export const countInHits = (hits: number[], start: number, spb: number) => hits.filter((t) => t > start - 4 * spb - 0.05 && t < start - 0.12).length;

/** Dérive du tempo : pente des écarts (ms par temps) → BPM gagnés ou perdus sur la durée. */
export function drift(matches: Match[], beatSec: number): number {
  const pts = matches.map((m, i) => [i, m.dev] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 4) return 0;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  const slope = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0); // ms par cible
  // Des attaques de plus en plus en avance = on accélère.
  const perBeat = slope / 1000; // s par temps
  const newBeat = beatSec + perBeat;
  return Math.round(60 / newBeat - 60 / beatSec);
}

/** Verdict en mots pour un écart moyen. */
export function tendency(meanMs: number, tolMs: number): string {
  if (Math.abs(meanMs) <= tolMs / 2) return 'bien en place';
  return meanMs < 0 ? `en avance de ${-meanMs} ms` : `en retard de ${meanMs} ms`;
}
