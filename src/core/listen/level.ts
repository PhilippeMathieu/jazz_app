// Niveau du micro. Sans contrôle de gain (réglage nécessaire pour entendre juste), le micro d'un téléphone donne
// un signal très faible : un piano joué normalement à un mètre arrive vers −60 dBFS, le bruit de la pièce vers
// −90 dBFS. Les réglages de la détection (seuils, attaques) ont été calibrés sur les échantillons de piano, bien
// plus forts. On amplifie donc le micro pour amener le bruit de fond de la pièce à NORM_FLOOR, et le seuil de
// silence suit ce bruit de fond : on entend un piano joué doucement, sans prendre le silence pour une note.

/** Bruit de fond visé après amplification (le niveau du bruit des échantillons de test). */
export const NORM_FLOOR = 0.001;
/** Amplification maximale (+50 dB) : au-delà, un micro presque muet ferait entendre des notes dans le souffle. */
export const MAX_GAIN = 300;
/** Seuil de silence minimal, après amplification. */
export const GATE_MIN = 0.003;

/** Bruit de fond : le 10e centile des niveaux mesurés (le piano ne joue pas tout le temps). */
export function floorOf(levels: ArrayLike<number>): number {
  const a = Array.from(levels).sort((x, y) => x - y);
  if (!a.length) return 0;
  return a[Math.floor(a.length * 0.1)];
}

/** Amplification qui amène ce bruit de fond à NORM_FLOOR (jamais d'atténuation). */
export const gainFor = (floor: number) => Math.min(MAX_GAIN, Math.max(1, NORM_FLOOR / Math.max(floor, 1e-9)));

/** Seuil de silence (après amplification) : 4 fois le bruit de fond. sens > 1 : plus sensible. */
export const gateFor = (floor: number, gain: number, sens = 1) => Math.max(GATE_MIN, 4 * floor * gain) / sens;
